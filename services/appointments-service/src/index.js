require('dotenv').config();
const crypto = require('crypto');
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const amqp = require('amqplib');

const app = express();
// CORS: solo permitir orígenes configurados (whitelist)
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000').split(',');
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) cb(null, true);
    else cb(new Error('Not allowed by CORS'));
  },
}));
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

const BUSINESS_HOURS = ['09:00', '10:00', '11:00', '14:00', '15:00', '16:00', '17:00'];

async function validateAppointmentToken(req, res, next) {
  const token = req.headers['x-appointment-token'] || req.query.token;
  const { id } = req.params;
  if (!token) return res.status(401).json({ error: 'Se requiere token de cita (X-Appointment-Token).' });
  try {
    const result = await pool.query('SELECT id FROM appointments WHERE id = $1 AND access_token = $2', [id, token]);
    if (result.rows.length === 0) return res.status(403).json({ error: 'Token inválido o cita no encontrada.' });
    next();
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor al validar token.' });
  }
}

app.get('/health', (req, res) => {
  res.json({ status: 'OK', service: 'appointments-service' });
});

// ========================================================
// ENDPOINT: Crear Cita (Transacción T1)
// ========================================================
app.post('/api/appointments', async (req, res) => {
  const { business_id, service_id, provider_id, customer_id, startTime, endTime } = req.body;

  try {
    // 0. Validar que el proveedor ofrezca este servicio y que ambos pertenezcan al mismo negocio
    const psCheck = await pool.query(
      `SELECT 1 FROM provider_services ps
       JOIN services s ON s.id = ps.service_id
       JOIN providers p ON p.id = ps.provider_id
       WHERE ps.provider_id = $1 AND ps.service_id = $2
         AND s.business_id = $3 AND p.business_id = $3`,
      [provider_id, service_id, business_id]
    );
    if (psCheck.rows.length === 0) {
      return res.status(400).json({ error: 'El especialista no ofrece este servicio o no pertenece a este negocio.' });
    }

    // 1. Inserción atómica con ON CONFLICT para eliminar la race condition.
    //    El UNIQUE INDEX (provider_id, start_time_utc) WHERE status IN (...)
    //    garantiza que dos inserciones simultáneas NO puedan crear duplicados.
    const accessToken = crypto.randomBytes(20).toString('hex');
    const query = `
      INSERT INTO appointments (business_id, service_id, provider_id, customer_id, start_time_utc, end_time_utc, status, access_token)
      VALUES ($1, $2, $3, $4, $5, $6, 'confirmed', $7)
      RETURNING *;
    `;
    const values = [business_id, service_id, provider_id, customer_id, startTime, endTime, accessToken];
    
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
        action: 'CREATED',
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
      accessToken: newAppointment.access_token,
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
    // Upsert atómico: elimina la race condition del flujo SELECT→INSERT
    const upsertResult = await pool.query(`
      INSERT INTO customers (name, phone_number, email, preferred_locale)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (phone_number) DO UPDATE
        SET email = COALESCE(NULLIF(customers.email, ''), EXCLUDED.email)
      RETURNING id, visit_count, has_free_appointment
    `, [name, phone_number, email, preferred_locale]);

    let customer = upsertResult.rows[0];

    // Lógica de Lealtad: Cada 7 visitas, la cita es gratis.
    if (customer.visit_count > 0 && customer.visit_count % 7 === 0 && !customer.has_free_appointment) {
      await pool.query('UPDATE customers SET has_free_appointment = true WHERE id = $1', [customer.id]);
      customer.has_free_appointment = true;
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
  const { providerId, date, timezone } = req.query; // date en formato YYYY-MM-DD
  const tz = timezone || 'UTC';
  try {
    // 1. Definir horario comercial base (ej: 09:00 a 17:00, cada hora)
    const allSlots = BUSINESS_HOURS;

    // 2. Buscar en PostgreSQL turnos confirmados en la zona horaria local del negocio
    const pgQuery = `
      SELECT to_char(start_time_utc AT TIME ZONE $3, 'HH24:MI') AS local_time
      FROM appointments
      WHERE provider_id = $1
        AND (start_time_utc AT TIME ZONE $3)::date = $2::date
        AND status IN ('confirmed', 'pending');
    `;
    const pgResult = await pool.query(pgQuery, [providerId, date, tz]);

    const bookedInPg = pgResult.rows.map(row => row.local_time);

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
// ENDPOINT: Consultar Cita (Transacción T21)
// ========================================================
app.get('/api/appointments/:id', validateAppointmentToken, async (req, res) => {
  try {
    const query = `
      SELECT a.id, a.start_time_utc, a.end_time_utc, a.status, a.payment_status,
             s.name as service_name, s.duration_minutes, s.price,
             p.name as provider_name, c.name as customer_name
      FROM appointments a
      JOIN services s ON a.service_id = s.id
      JOIN providers p ON a.provider_id = p.id
      JOIN customers c ON a.customer_id = c.id
      WHERE a.id = $1;
    `;
    const result = await pool.query(query, [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Cita no encontrada' });
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error al consultar cita:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// ========================================================
// ENDPOINT: Reprogramar Cita (Transacción T22)
// ========================================================
app.put('/api/appointments/:id/reschedule', validateAppointmentToken, async (req, res) => {
  const { id } = req.params;
  const { newStartTime, newEndTime } = req.body; // Fechas en formato ISO

  const start = new Date(newStartTime);
  const end = new Date(newEndTime);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return res.status(400).json({ error: 'Fechas inválidas.' });
  }
  if (start <= new Date()) {
    return res.status(400).json({ error: 'No puedes reprogramar a una fecha en el pasado.' });
  }
  if (end <= start) {
    return res.status(400).json({ error: 'La hora de fin debe ser posterior a la hora de inicio.' });
  }

  // Validar que la hora esté dentro del horario comercial
  const localTime = req.body.newLocalTime || `${String(start.getUTCHours()).padStart(2,'0')}:${String(start.getUTCMinutes()).padStart(2,'0')}`;
  if (!BUSINESS_HOURS.includes(localTime)) {
    return res.status(400).json({ error: `Horario no válido. Los horarios disponibles son: ${BUSINESS_HOURS.join(', ')}` });
  }

  try {
    // 1. Verificar si la cita existe y obtener el provider_id
    const checkQuery = await pool.query('SELECT provider_id, status FROM appointments WHERE id = $1', [id]);
    if (checkQuery.rows.length === 0) return res.status(404).json({ error: 'Cita no encontrada' });
    if (checkQuery.rows[0].status === 'cancelled') return res.status(400).json({ error: 'No se puede reprogramar una cita cancelada' });
    
    const provider_id = checkQuery.rows[0].provider_id;

    // 2. Actualizar hora atómicamente. El UNIQUE INDEX protegerá si el nuevo slot está ocupado
    const query = `
      UPDATE appointments 
      SET start_time_utc = $1, end_time_utc = $2 
      WHERE id = $3 RETURNING *;
    `;
    let result;
    try {
      result = await pool.query(query, [newStartTime, newEndTime, id]);
    } catch (dbError) {
      if (dbError.code === '23505') {
        return res.status(409).json({ error: 'Lo sentimos, el nuevo horario fue tomado por alguien más.' });
      }
      throw dbError;
    }

    const updatedAppointment = result.rows[0];

    // 3. Liberar el lock de Redis del *nuevo* horario (Si se bloqueó en el paso 3 del UI, ya es permanente)
    const dateObj = new Date(newStartTime);
    const dateStr = dateObj.toISOString().split('T')[0];
    const timeStr = dateObj.toISOString().substring(11, 16);
    await redisClient.del(`lock:${provider_id}:${dateStr}:${timeStr}`);

    // 4. Publicar evento RESCHEDULED en RabbitMQ
    if (channel) {
      const eventData = {
        action: 'RESCHEDULED',
        appointmentId: updatedAppointment.id,
        customerId: updatedAppointment.customer_id,
        startTime: newStartTime,
      };
      channel.sendToQueue('citas_creadas', Buffer.from(JSON.stringify(eventData)));
    }

    res.json({ message: 'Cita reprogramada exitosamente', appointment: updatedAppointment });
  } catch (error) {
    console.error('Error al reprogramar cita:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// ========================================================
// ENDPOINT: Cancelar Cita (Transacción T23)
// ========================================================
app.put('/api/appointments/:id/cancel', validateAppointmentToken, async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;

  try {
    const query = `
      UPDATE appointments 
      SET status = 'cancelled', cancellation_reason = $1, cancelled_at = NOW()
      WHERE id = $2 AND status != 'cancelled'
      RETURNING *;
    `;
    const result = await pool.query(query, [reason || 'Cancelada por el usuario', id]);
    
    if (result.rows.length === 0) {
      return res.status(409).json({ error: 'La cita ya estaba cancelada.' });
    }

    const cancelledAppointment = result.rows[0];

    // Publicar evento CANCELLED en RabbitMQ
    if (channel) {
      const eventData = {
        action: 'CANCELLED',
        appointmentId: cancelledAppointment.id,
        customerId: cancelledAppointment.customer_id,
        startTime: cancelledAppointment.start_time_utc,
      };
      // Usamos la misma cola por conveniencia, el worker diferenciará por action
      channel.sendToQueue('citas_creadas', Buffer.from(JSON.stringify(eventData)));
    }

    res.json({ message: 'Cita cancelada exitosamente', appointment: cancelledAppointment });
  } catch (error) {
    console.error('Error al cancelar cita:', error);
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
