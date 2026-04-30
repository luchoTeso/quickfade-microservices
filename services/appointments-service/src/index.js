require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const amqp = require('amqplib');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;

// 1. Configuración de la conexión a PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Probar que la base de datos se conectó correctamente
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('❌ Error conectando a PostgreSQL:', err.message);
  } else {
    console.log('✅ Conectado a PostgreSQL exitosamente. Hora del servidor BD:', res.rows[0].now);
  }
});

// 2. Configuración de RabbitMQ
let channel = null;
async function connectRabbitMQ() {
  if (!process.env.RABBITMQ_URL) {
    console.error('❌ RABBITMQ_URL no está definida en .env. Abortando conexión a RabbitMQ.');
    return;
  }
  try {
    const connection = await amqp.connect(process.env.RABBITMQ_URL);
    channel = await connection.createChannel();
    await channel.assertQueue('citas_creadas', { durable: true });
    console.log('✅ Conectado a RabbitMQ exitosamente.');
  } catch (error) {
    console.error('❌ Error conectando a RabbitMQ:', error.message);
    setTimeout(connectRabbitMQ, 5000); // Reintentar
  }
}
connectRabbitMQ();

// 3. Configuración de Redis (Para bloqueos temporales)
const redis = require('redis');
const redisClient = redis.createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});

redisClient.on('error', (err) => console.error('❌ Error en Redis:', err));
redisClient.on('connect', () => console.log('✅ Conectado a Redis exitosamente.'));
redisClient.connect();

app.get('/health', (req, res) => {
  res.json({ status: 'OK', service: 'appointments-service' });
});

// ========================================================
// ENDPOINT: Crear Cita (Transacción T1)
// ========================================================
app.post('/api/appointments', async (req, res) => {
  const { business_id, service_id, provider_id, customer_id, startTime, endTime } = req.body;

  try {
    // 0. Validar que el proveedor realmente ofrezca este servicio
    const psCheck = await pool.query(
      'SELECT 1 FROM provider_services WHERE provider_id = $1 AND service_id = $2',
      [provider_id, service_id]
    );
    if (psCheck.rows.length === 0) {
      return res.status(400).json({ error: 'El especialista seleccionado no ofrece este servicio.' });
    }

    // 1. Inserción atómica con ON CONFLICT para eliminar la race condition.
    //    El UNIQUE INDEX (provider_id, start_time_utc) WHERE status IN (...)
    //    garantiza que dos inserciones simultáneas NO puedan crear duplicados.
    const query = `
      INSERT INTO appointments (business_id, service_id, provider_id, customer_id, start_time_utc, end_time_utc, status)
      VALUES ($1, $2, $3, $4, $5, $6, 'confirmed')
      RETURNING *;
    `;
    const values = [business_id, service_id, provider_id, customer_id, startTime, endTime];
    
    let result;
    try {
      result = await pool.query(query, values);
    } catch (dbError) {
      // Si viola el UNIQUE INDEX, PostgreSQL lanza error código 23505
      if (dbError.code === '23505') {
        return res.status(409).json({ error: 'Lo sentimos, este turno fue tomado por alguien más justo ahora.' });
      }
      throw dbError; // Re-lanzar si es otro error
    }
    const newAppointment = result.rows[0];
    
    // 2. Eliminar el candado temporal de Redis ahora que el turno es permanente
    const dateObj = new Date(startTime);
    const dateStr = dateObj.toISOString().split('T')[0];
    const timeStr = dateObj.toISOString().substring(11, 16);
    await redisClient.del(`lock:${provider_id}:${dateStr}:${timeStr}`);

    // 3. Publicar evento en RabbitMQ para notificar al cliente
    if (channel) {
      const eventData = {
        appointmentId: newAppointment.id,
        customerId: customer_id,
        businessId: business_id,
        startTime: startTime,
        status: 'confirmed'
      };
      channel.sendToQueue('citas_creadas', Buffer.from(JSON.stringify(eventData)));
      console.log(`📨 Evento publicado en RabbitMQ: citas_creadas (ID: ${newAppointment.id})`);
    } else {
      console.error('⚠️ Canal de RabbitMQ no disponible, el evento no se publicó.');
    }

    // 4. Actualizar fidelización: sumar visita, y SOLO consumir el premio si la cita actual era gratuita
    const customerData = await pool.query('SELECT has_free_appointment FROM customers WHERE id = $1', [customer_id]);
    const wasFree = customerData.rows[0]?.has_free_appointment || false;
    
    await pool.query(`
      UPDATE customers 
      SET visit_count = visit_count + 1,
          has_free_appointment = CASE WHEN has_free_appointment = true THEN false ELSE has_free_appointment END
      WHERE id = $1
    `, [customer_id]);

    res.status(201).json({
      message: '¡Cita creada con éxito!',
      appointment: newAppointment,
      loyaltyUsed: wasFree
    });
  } catch (error) {
    console.error('Error al crear cita:', error);
    res.status(500).json({ error: 'Hubo un error al procesar la cita' });
  }
});

// ========================================================
// ENDPOINT: Buscar/Crear Cliente y Fidelización (Módulo Lealtad)
// ========================================================
app.post('/api/customers/lookup', async (req, res) => {
  const { name, phone_number, email, preferred_locale } = req.body;
  try {
    // Buscar si existe el cliente por teléfono
    let query = `SELECT id, visit_count, has_free_appointment FROM customers WHERE phone_number = $1`;
    let result = await pool.query(query, [phone_number]);
    
    let customer;
    if (result.rows.length > 0) {
      customer = result.rows[0];
      // Lógica de Lealtad: Cada 7 visitas, la cita es gratis.
      // visit_count 7, 14, 21... → la siguiente es gratuita
      if (customer.visit_count > 0 && customer.visit_count % 7 === 0 && !customer.has_free_appointment) {
         await pool.query(`UPDATE customers SET has_free_appointment = true WHERE id = $1`, [customer.id]);
         customer.has_free_appointment = true;
      }
    } else {
      // Es un cliente nuevo (Se crea con valores por defecto: 0 visitas)
      const insertQuery = `
        INSERT INTO customers (name, phone_number, email, preferred_locale)
        VALUES ($1, $2, $3, $4) RETURNING id, visit_count, has_free_appointment
      `;
      const insertResult = await pool.query(insertQuery, [name, phone_number, email, preferred_locale]);
      customer = insertResult.rows[0];
    }
    
    res.json(customer);
  } catch (error) {
    console.error('Error en lookup de cliente:', error);
    res.status(500).json({ error: 'Error al procesar cliente' });
  }
});

// ========================================================
// ENDPOINT: Obtener Servicios por País (Transacción T11)
// ========================================================
app.get('/api/services/:countryCode', async (req, res) => {
  const { countryCode } = req.params;
  try {
    const query = `
      SELECT s.id, s.name, s.icon, s.duration_minutes, s.price, s.is_popular, b.id as business_id
      FROM services s
      JOIN businesses b ON s.business_id = b.id
      WHERE b.country_code = $1;
    `;
    const result = await pool.query(query, [countryCode.toUpperCase()]);
    res.json(result.rows);
  } catch (error) {
    console.error('Error al obtener servicios:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// ========================================================
// ENDPOINT: Obtener Especialistas (Transacción T12)
// ========================================================
app.get('/api/providers/:businessId', async (req, res) => {
  const { businessId } = req.params;
  try {
    const query = `
      SELECT p.id, p.name, p.initials, p.rating, p.review_count 
      FROM providers p
      WHERE p.business_id = $1;
    `;
    const result = await pool.query(query, [businessId]);
    res.json(result.rows);
  } catch (error) {
    console.error('Error al obtener especialistas:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// ========================================================
// ENDPOINT: Obtener Disponibilidad (Transacción T13)
// ========================================================
app.get('/api/availability', async (req, res) => {
  const { providerId, date } = req.query; // date en formato YYYY-MM-DD
  try {
    // 1. Definir horario comercial base (ej: 09:00 a 17:00, cada hora)
    const allSlots = ['09:00', '10:00', '11:00', '14:00', '15:00', '16:00', '17:00'];
    
    // 2. Buscar en PostgreSQL turnos confirmados para ese proveedor en esa fecha
    const pgQuery = `
      SELECT start_time_utc 
      FROM appointments 
      WHERE provider_id = $1 
      AND DATE(start_time_utc) = $2
      AND status IN ('confirmed', 'pending');
    `;
    const pgResult = await pool.query(pgQuery, [providerId, date]);
    
    // Extraer solo la hora en formato HH:MM
    const bookedInPg = pgResult.rows.map(row => {
      const d = new Date(row.start_time_utc);
      return d.toISOString().substring(11, 16); // Obtiene "HH:MM" de UTC
    });

    // 3. Buscar en Redis bloqueos temporales actuales para ese proveedor y fecha
    // Las llaves en Redis tendrán el formato: lock:providerId:date:time
    const keys = await redisClient.keys(`lock:${providerId}:${date}:*`);
    const bookedInRedis = keys.map(key => key.split(':').pop()); // Extrae el "time" al final

    // 4. Unir todos los horarios ocupados
    const allBooked = new Set([...bookedInPg, ...bookedInRedis]);

    // 5. Filtrar el horario base
    const availableSlots = allSlots.filter(slot => !allBooked.has(slot));

    res.json({ availableSlots });
  } catch (error) {
    console.error('Error al obtener disponibilidad:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// ========================================================
// ENDPOINT: Bloquear Horario Temporal (Transacción T14)
// ========================================================
app.post('/api/lock-slot', async (req, res) => {
  const { providerId, date, time } = req.body;
  const lockKey = `lock:${providerId}:${date}:${time}`;
  
  try {
    // Intentar crear la llave en Redis con NX (Solo si no existe) y EX (Expira en 600 segundos = 10 minutos)
    const result = await redisClient.set(lockKey, 'locked_by_user', {
      NX: true,
      EX: 600 
    });

    if (result) {
      res.json({ success: true, message: 'Horario bloqueado exitosamente por 10 minutos.' });
    } else {
      // Si result es null, alguien más acaba de ganar el bloqueo en esa fracción de segundo
      res.status(409).json({ success: false, error: 'Ese horario acaba de ser reservado por alguien más.' });
    }
  } catch (error) {
    console.error('Error al bloquear horario en Redis:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});
// ========================================================
// ENDPOINT: Analíticas y Dashboard (Administración)
// ========================================================
app.get('/api/analytics', async (req, res) => {
  try {
    // 1. Ingresos Totales y Cantidad de Citas
    const revQuery = `
      SELECT COUNT(a.id) as total_appointments, SUM(s.price) as total_revenue
      FROM appointments a
      JOIN services s ON a.service_id = s.id
      WHERE a.status = 'confirmed';
    `;
    const revResult = await pool.query(revQuery);
    
    // 2. Clientes y Lealtad
    const cusQuery = `
      SELECT COUNT(id) as total_customers, 
             SUM(CASE WHEN visit_count >= 6 THEN 1 ELSE 0 END) as loyal_customers
      FROM customers;
    `;
    const cusResult = await pool.query(cusQuery);

    // 3. Últimas 10 citas detalladas
    const recentQuery = `
      SELECT a.id, a.start_time_utc, c.name as customer_name, s.name as service_name, p.name as provider_name, s.price
      FROM appointments a
      JOIN customers c ON a.customer_id = c.id
      JOIN services s ON a.service_id = s.id
      JOIN providers p ON a.provider_id = p.id
      ORDER BY a.start_time_utc DESC
      LIMIT 10;
    `;
    const recentResult = await pool.query(recentQuery);

    res.json({
      metrics: {
        totalAppointments: parseInt(revResult.rows[0].total_appointments) || 0,
        totalRevenue: parseFloat(revResult.rows[0].total_revenue) || 0,
        totalCustomers: parseInt(cusResult.rows[0].total_customers) || 0,
        loyalCustomers: parseInt(cusResult.rows[0].loyal_customers) || 0
      },
      recentAppointments: recentResult.rows
    });
  } catch (error) {
    console.error('Error al obtener analíticas:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Appointments Service corriendo en http://localhost:${PORT}`);
});
