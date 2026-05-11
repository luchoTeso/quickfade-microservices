require('./telemetry'); // Debe ser el primer require — instrumenta Express, pg, Redis, amqplib
require('dotenv').config();
const crypto = require('crypto');
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const amqp = require('amqplib');
const CircuitBreaker = require('opossum');
const client = require('prom-client');

const app = express();
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000').split(',');
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) cb(null, true);
    else cb(new Error('Not allowed by CORS'));
  },
}));
app.use(express.json());

const PORT = process.env.PORT || 3001;

// ========================================================
// PROMETHEUS — Métricas
// ========================================================
const register = new client.Registry();
client.collectDefaultMetrics({ register });

const httpDuration = new client.Histogram({
  name: 'appointments_http_request_duration_seconds',
  help: 'Duración de requests HTTP en appointments-service',
  labelNames: ['method', 'route', 'status'],
  registers: [register],
});

const dbBreakerState = new client.Gauge({
  name: 'circuit_breaker_state',
  help: '0=cerrado 0.5=semi-abierto 1=abierto',
  labelNames: ['breaker'],
  registers: [register],
});

app.use((req, res, next) => {
  const end = httpDuration.startTimer({ method: req.method, route: req.path });
  res.on('finish', () => end({ status: res.statusCode }));
  next();
});

// ========================================================
// POSTGRESQL
// ========================================================
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

pool.query('SELECT NOW()', (err, res) => {
  if (err) console.error('❌ Error conectando a PostgreSQL:', err.message);
  else console.log('✅ Conectado a PostgreSQL. Hora BD:', res.rows[0].now);
});

// ========================================================
// CIRCUIT BREAKER — PostgreSQL
// ========================================================
const dbBreakerOpts = {
  timeout: 5000,
  errorThresholdPercentage: 50,
  resetTimeout: 30000,
  name: 'postgresql',
};
const dbBreaker = new CircuitBreaker((text, values) => pool.query(text, values), dbBreakerOpts);
dbBreaker.on('open',     () => { console.warn('⚡ CB PostgreSQL ABIERTO'); dbBreakerState.set({ breaker: 'postgresql' }, 1); });
dbBreaker.on('halfOpen', () => { console.log('🔄 CB PostgreSQL semi-abierto'); dbBreakerState.set({ breaker: 'postgresql' }, 0.5); });
dbBreaker.on('close',    () => { console.log('✅ CB PostgreSQL cerrado'); dbBreakerState.set({ breaker: 'postgresql' }, 0); });

const dbQuery = (text, values) => dbBreaker.fire(text, values);

// ========================================================
// REDIS — Distributed Locks
// ========================================================
const redis = require('redis');
const redisClient = redis.createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' });
redisClient.on('error', (err) => console.error('❌ Error en Redis:', err));
redisClient.on('connect', () => console.log('✅ Conectado a Redis.'));
redisClient.connect();

// ========================================================
// CIRCUIT BREAKER — Redis
// ========================================================
const redisCBOpts = { timeout: 2000, errorThresholdPercentage: 50, resetTimeout: 15000 };

const redisSetBreaker  = new CircuitBreaker((k, v, o) => redisClient.set(k, v, o),  { ...redisCBOpts, name: 'redis-set' });
const redisDelBreaker  = new CircuitBreaker((k)       => redisClient.del(k),         { ...redisCBOpts, name: 'redis-del' });
const redisKeysBreaker = new CircuitBreaker((p)       => redisClient.keys(p),        { ...redisCBOpts, name: 'redis-keys' });

for (const [name, breaker] of [['redis-set', redisSetBreaker], ['redis-del', redisDelBreaker], ['redis-keys', redisKeysBreaker]]) {
  breaker.on('open',     () => { console.warn(`⚡ CB ${name} ABIERTO`);      dbBreakerState.set({ breaker: name }, 1); });
  breaker.on('halfOpen', () => { console.log(`🔄 CB ${name} semi-abierto`);  dbBreakerState.set({ breaker: name }, 0.5); });
  breaker.on('close',    () => { console.log(`✅ CB ${name} cerrado`);        dbBreakerState.set({ breaker: name }, 0); });
}

const safeRedisSet  = (k, v, o) => redisSetBreaker.fire(k, v, o);
const safeRedisDel  = (k)       => redisDelBreaker.fire(k);
const safeRedisKeys = (p)       => redisKeysBreaker.fire(p);

// ========================================================
// RABBITMQ — con Dead Letter Queue
// ========================================================
let channel = null;

async function connectRabbitMQ() {
  if (!process.env.RABBITMQ_URL) {
    console.error('❌ RABBITMQ_URL no definida. Abortando.');
    return;
  }
  try {
    const connection = await amqp.connect(process.env.RABBITMQ_URL);
    channel = await connection.createChannel();

    // Dead Letter Exchange
    await channel.assertExchange('turnos_dlx', 'direct', { durable: true });

    // Queues con DLQ args.
    // NOTA: Si las queues ya existen (sin DLQ args), ejecutá `docker-compose down -v` para recrearlas.
    const dlqArgs = (routingKey) => ({
      durable: true,
      arguments: {
        'x-dead-letter-exchange': 'turnos_dlx',
        'x-dead-letter-routing-key': routingKey,
      },
    });

    await channel.assertQueue('citas_creadas',    dlqArgs('citas.dead'));
    await channel.assertQueue('pagos_confirmados', dlqArgs('pagos.dead'));

    // Dead Letter Queues para reintentos manuales / monitoreo
    await channel.assertQueue('citas_creadas.dead',    { durable: true });
    await channel.assertQueue('pagos_confirmados.dead', { durable: true });
    await channel.bindQueue('citas_creadas.dead',    'turnos_dlx', 'citas.dead');
    await channel.bindQueue('pagos_confirmados.dead', 'turnos_dlx', 'pagos.dead');

    console.log('✅ Conectado a RabbitMQ con Dead Letter Queue configurada.');

    // Consumir pagos confirmados desde payments-service
    channel.consume('pagos_confirmados', async (msg) => {
      if (!msg) return;
      try {
        const event = JSON.parse(msg.content.toString());
        if (event.action === 'PAYMENT_SUCCEEDED') {
          console.log(`💰 Pago confirmado para cita #${event.appointmentId}`);

          const result = await dbQuery(
            `UPDATE appointments SET status = 'confirmed', payment_status = 'deposit_paid'
             WHERE id = $1 AND status = 'pending' RETURNING *`,
            [event.appointmentId]
          );

          if (result.rows.length > 0) {
            const appt = result.rows[0];
            await dbQuery(`
              UPDATE customers
              SET visit_count = visit_count + 1,
                  has_free_appointment = CASE
                    WHEN (visit_count + 1) % 7 = 0 THEN true
                    ELSE has_free_appointment
                  END
              WHERE id = $1
            `, [appt.customer_id]);

            if (channel) {
              channel.sendToQueue('citas_creadas', Buffer.from(JSON.stringify({
                action: 'CREATED',
                appointmentId: appt.id,
                customerId: appt.customer_id,
                businessId: appt.business_id,
                startTime: appt.start_time_utc,
                status: 'confirmed',
              })));
            }
            console.log('✅ Cita confirmada tras pago, notificación encolada.');
          }
        }
        channel.ack(msg);
      } catch (err) {
        console.error('❌ Error procesando pago confirmado:', err.message);
        // NACK sin requeue → va a pagos_confirmados.dead (DLQ)
        channel.nack(msg, false, false);
      }
    });

    connection.on('error', (err) => { console.error('❌ RabbitMQ error:', err.message); channel = null; });
    connection.on('close', () => {
      console.warn('⚠️ RabbitMQ cerrado. Reintentando en 5s...');
      channel = null;
      setTimeout(connectRabbitMQ, 5000);
    });
  } catch (error) {
    console.error('❌ Error conectando a RabbitMQ:', error.message);
    setTimeout(connectRabbitMQ, 5000);
  }
}
connectRabbitMQ();

const BUSINESS_HOURS = ['09:00', '10:00', '11:00', '14:00', '15:00', '16:00', '17:00'];

async function validateAppointmentToken(req, res, next) {
  const token = req.headers['x-appointment-token'] || req.query.token;
  const { id } = req.params;
  if (!token) return res.status(401).json({ error: 'Se requiere token de cita (X-Appointment-Token).' });
  try {
    const result = await dbQuery('SELECT id FROM appointments WHERE id = $1 AND access_token = $2', [id, token]);
    if (result.rows.length === 0) return res.status(403).json({ error: 'Token inválido o cita no encontrada.' });
    next();
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor al validar token.' });
  }
}

// ========================================================
// ENDPOINTS DE OBSERVABILIDAD
// ========================================================
app.get('/health', (req, res) => res.json({ status: 'OK', service: 'appointments-service' }));

app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

// ========================================================
// ENDPOINT: Crear Cita (T1)
// ========================================================
app.post('/api/appointments', async (req, res) => {
  const { business_id, service_id, provider_id, customer_id, startTime, endTime } = req.body;

  if (!business_id || !service_id || !provider_id || !customer_id || !startTime || !endTime)
    return res.status(400).json({ error: 'Faltan campos obligatorios.' });

  const start = new Date(startTime);
  const end   = new Date(endTime);
  if (isNaN(start.getTime()) || isNaN(end.getTime()))
    return res.status(400).json({ error: 'startTime o endTime no son fechas válidas.' });
  if (end <= start)
    return res.status(400).json({ error: 'endTime debe ser posterior a startTime.' });
  if (start <= new Date())
    return res.status(400).json({ error: 'No se pueden crear citas en el pasado.' });

  try {
    const psCheck = await dbQuery(
      `SELECT 1 FROM provider_services ps
       JOIN services s ON s.id = ps.service_id
       JOIN providers p ON p.id = ps.provider_id
       WHERE ps.provider_id = $1 AND ps.service_id = $2
         AND s.business_id = $3 AND p.business_id = $3`,
      [provider_id, service_id, business_id]
    );
    if (psCheck.rows.length === 0)
      return res.status(400).json({ error: 'El especialista no ofrece este servicio o no pertenece a este negocio.' });

    const accessToken = crypto.randomBytes(20).toString('hex');
    const custCheck = await dbQuery('SELECT has_free_appointment FROM customers WHERE id = $1', [customer_id]);
    const isFreeByLoyalty = custCheck.rows[0]?.has_free_appointment || false;
    const paymentStatus  = isFreeByLoyalty ? 'free_loyalty' : 'pending';
    const initialStatus  = isFreeByLoyalty ? 'confirmed'    : 'pending';

    let result;
    try {
      result = await dbQuery(
        `INSERT INTO appointments (business_id, service_id, provider_id, customer_id, start_time_utc, end_time_utc, status, access_token, payment_status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
        [business_id, service_id, provider_id, customer_id, startTime, endTime, initialStatus, accessToken, paymentStatus]
      );
    } catch (dbError) {
      if (dbError.code === '23505')
        return res.status(409).json({ error: 'Lo sentimos, este turno fue tomado por alguien más justo ahora.' });
      throw dbError;
    }
    const newAppointment = result.rows[0];

    if (isFreeByLoyalty) {
      const dateObj = new Date(startTime);
      const dateStr = dateObj.toISOString().split('T')[0];
      const timeStr = dateObj.toISOString().substring(11, 16);
      await safeRedisDel(`lock:${provider_id}:${dateStr}:${timeStr}`);
    }

    if (initialStatus === 'confirmed') {
      if (channel) {
        channel.sendToQueue('citas_creadas', Buffer.from(JSON.stringify({
          action: 'CREATED', appointmentId: newAppointment.id,
          customerId: customer_id, businessId: business_id,
          startTime, status: 'confirmed',
        })));
        console.log(`📨 Evento publicado en RabbitMQ: citas_creadas (ID: ${newAppointment.id})`);
      }
      await dbQuery(`
        UPDATE customers SET visit_count = visit_count + 1, has_free_appointment = false WHERE id = $1
      `, [customer_id]);
    }

    res.status(201).json({
      message: initialStatus === 'confirmed' ? '¡Cita confirmada con éxito!' : 'Cita pre-reservada, esperando pago',
      appointment: newAppointment,
      accessToken: newAppointment.access_token,
      loyaltyUsed: isFreeByLoyalty,
      requiresPayment: !isFreeByLoyalty,
    });
  } catch (error) {
    console.error('Error al crear cita:', error.message);
    const msg = error.name === 'OpenCircuitError'
      ? 'Servicio temporalmente no disponible. Intenta en unos segundos.'
      : 'Hubo un error al procesar la cita';
    res.status(error.name === 'OpenCircuitError' ? 503 : 500).json({ error: msg });
  }
});

// ========================================================
// ENDPOINT: Buscar/Crear Cliente (Módulo Lealtad)
// ========================================================
app.post('/api/customers/lookup', async (req, res) => {
  const { name, phone_number, email, preferred_locale } = req.body;
  try {
    const upsertResult = await dbQuery(`
      INSERT INTO customers (name, phone_number, email, preferred_locale)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (phone_number) DO UPDATE
        SET email = COALESCE(NULLIF(customers.email, ''), EXCLUDED.email)
      RETURNING id, visit_count, has_free_appointment
    `, [name, phone_number, email, preferred_locale]);

    let customer = upsertResult.rows[0];
    if (customer.visit_count > 0 && customer.visit_count % 7 === 0 && !customer.has_free_appointment) {
      await dbQuery('UPDATE customers SET has_free_appointment = true WHERE id = $1', [customer.id]);
      customer.has_free_appointment = true;
    }
    res.json(customer);
  } catch (error) {
    console.error('Error en lookup de cliente:', error.message);
    res.status(500).json({ error: 'Error al procesar cliente' });
  }
});

// ========================================================
// ENDPOINT: Servicios por País (T11)
// ========================================================
app.get('/api/services/:countryCode', async (req, res) => {
  try {
    const result = await dbQuery(
      `SELECT s.id, s.name, s.icon, s.duration_minutes, s.price, s.is_popular, b.id as business_id
       FROM services s JOIN businesses b ON s.business_id = b.id WHERE b.country_code = $1`,
      [req.params.countryCode.toUpperCase()]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error al obtener servicios:', error.message);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// ========================================================
// ENDPOINT: Especialistas (T12)
// ========================================================
app.get('/api/providers/:businessId', async (req, res) => {
  try {
    const result = await dbQuery(
      `SELECT p.id, p.name, p.initials, p.rating, p.review_count
       FROM providers p WHERE p.business_id = $1`,
      [req.params.businessId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error al obtener especialistas:', error.message);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// ========================================================
// ENDPOINT: Disponibilidad (T13)
// ========================================================
app.get('/api/availability', async (req, res) => {
  const { providerId, date, timezone } = req.query;
  const tz = timezone || 'UTC';
  try {
    const pgResult = await dbQuery(
      `SELECT to_char(start_time_utc AT TIME ZONE $3, 'HH24:MI') AS local_time
       FROM appointments
       WHERE provider_id = $1 AND (start_time_utc AT TIME ZONE $3)::date = $2::date
         AND status IN ('confirmed', 'pending')`,
      [providerId, date, tz]
    );
    const bookedInPg = pgResult.rows.map(r => r.local_time);
    const keys = await safeRedisKeys(`lock:${providerId}:${date}:*`);
    const bookedInRedis = keys.map(k => k.split(':').pop());
    const allBooked = new Set([...bookedInPg, ...bookedInRedis]);
    res.json({ availableSlots: BUSINESS_HOURS.filter(s => !allBooked.has(s)) });
  } catch (error) {
    console.error('Error al obtener disponibilidad:', error.message);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// ========================================================
// ENDPOINT: Bloquear Horario Temporal (T14)
// ========================================================
app.post('/api/lock-slot', async (req, res) => {
  const { providerId, date, time } = req.body;
  const lockKey = `lock:${providerId}:${date}:${time}`;
  try {
    const result = await safeRedisSet(lockKey, 'locked_by_user', { NX: true, EX: 600 });
    if (result) res.json({ success: true, message: 'Horario bloqueado por 10 minutos.' });
    else res.status(409).json({ success: false, error: 'Ese horario acaba de ser reservado por alguien más.' });
  } catch (error) {
    console.error('Error al bloquear horario:', error.message);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// ========================================================
// ENDPOINT: Consultar Cita (T21)
// ========================================================
app.get('/api/appointments/:id', validateAppointmentToken, async (req, res) => {
  try {
    const result = await dbQuery(
      `SELECT a.id, a.start_time_utc, a.end_time_utc, a.status, a.payment_status,
              s.name as service_name, s.duration_minutes, s.price,
              p.name as provider_name, c.name as customer_name
       FROM appointments a
       JOIN services s ON a.service_id = s.id
       JOIN providers p ON a.provider_id = p.id
       JOIN customers c ON a.customer_id = c.id
       WHERE a.id = $1`,
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Cita no encontrada' });
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error al consultar cita:', error.message);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// ========================================================
// ENDPOINT: Reprogramar Cita (T22)
// ========================================================
app.put('/api/appointments/:id/reschedule', validateAppointmentToken, async (req, res) => {
  const { id } = req.params;
  const { newStartTime, newEndTime } = req.body;

  const start = new Date(newStartTime);
  const end   = new Date(newEndTime);
  if (isNaN(start.getTime()) || isNaN(end.getTime()))
    return res.status(400).json({ error: 'Fechas inválidas.' });
  if (start <= new Date())
    return res.status(400).json({ error: 'No puedes reprogramar a una fecha en el pasado.' });
  if (end <= start)
    return res.status(400).json({ error: 'La hora de fin debe ser posterior a la de inicio.' });

  const localTime = req.body.newLocalTime ||
    `${String(start.getUTCHours()).padStart(2,'0')}:${String(start.getUTCMinutes()).padStart(2,'0')}`;
  if (!BUSINESS_HOURS.includes(localTime))
    return res.status(400).json({ error: `Horario no válido. Disponibles: ${BUSINESS_HOURS.join(', ')}` });

  try {
    const checkQuery = await dbQuery('SELECT provider_id, status FROM appointments WHERE id = $1', [id]);
    if (checkQuery.rows.length === 0) return res.status(404).json({ error: 'Cita no encontrada' });
    if (checkQuery.rows[0].status === 'cancelled') return res.status(400).json({ error: 'No se puede reprogramar una cita cancelada' });
    const provider_id = checkQuery.rows[0].provider_id;

    let result;
    try {
      result = await dbQuery(
        'UPDATE appointments SET start_time_utc = $1, end_time_utc = $2 WHERE id = $3 RETURNING *',
        [newStartTime, newEndTime, id]
      );
    } catch (dbError) {
      if (dbError.code === '23505')
        return res.status(409).json({ error: 'Lo sentimos, el nuevo horario fue tomado por alguien más.' });
      throw dbError;
    }

    const updatedAppointment = result.rows[0];
    const dateStr = new Date(newStartTime).toISOString().split('T')[0];
    const timeStr = new Date(newStartTime).toISOString().substring(11, 16);
    await safeRedisDel(`lock:${provider_id}:${dateStr}:${timeStr}`);

    if (channel) {
      channel.sendToQueue('citas_creadas', Buffer.from(JSON.stringify({
        action: 'RESCHEDULED',
        appointmentId: updatedAppointment.id,
        customerId: updatedAppointment.customer_id,
        startTime: newStartTime,
      })));
    }

    res.json({ message: 'Cita reprogramada exitosamente', appointment: updatedAppointment });
  } catch (error) {
    console.error('Error al reprogramar cita:', error.message);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// ========================================================
// ENDPOINT: Cancelar Cita (T23)
// ========================================================
app.put('/api/appointments/:id/cancel', validateAppointmentToken, async (req, res) => {
  const { id } = req.params;
  const safeReason = ((req.body.reason || 'Cancelada por el usuario')).substring(0, 500);

  try {
    const result = await dbQuery(
      `UPDATE appointments
       SET status = 'cancelled', cancellation_reason = $1, cancelled_at = NOW()
       WHERE id = $2 AND status != 'cancelled' RETURNING *`,
      [safeReason, id]
    );
    if (result.rows.length === 0)
      return res.status(409).json({ error: 'La cita ya estaba cancelada.' });

    const cancelled = result.rows[0];
    const cancelDateStr = new Date(cancelled.start_time_utc).toISOString().split('T')[0];
    const cancelTimeStr = new Date(cancelled.start_time_utc).toISOString().substring(11, 16);
    await safeRedisDel(`lock:${cancelled.provider_id}:${cancelDateStr}:${cancelTimeStr}`);

    if (channel) {
      channel.sendToQueue('citas_creadas', Buffer.from(JSON.stringify({
        action: 'CANCELLED',
        appointmentId: cancelled.id,
        customerId: cancelled.customer_id,
        startTime: cancelled.start_time_utc,
      })));
    }

    res.json({ message: 'Cita cancelada exitosamente', appointment: cancelled });
  } catch (error) {
    console.error('Error al cancelar cita:', error.message);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// ========================================================
// ENDPOINT: Analíticas (Admin)
// ========================================================
app.get('/api/analytics', async (req, res) => {
  try {
    const revResult = await dbQuery(
      `SELECT COUNT(a.id) as total_appointments, SUM(s.price) as total_revenue
       FROM appointments a JOIN services s ON a.service_id = s.id WHERE a.status = 'confirmed'`
    );
    const cusResult = await dbQuery(
      `SELECT COUNT(id) as total_customers,
              SUM(CASE WHEN visit_count >= 7 THEN 1 ELSE 0 END) as loyal_customers
       FROM customers`
    );
    const recentResult = await dbQuery(
      `SELECT a.id, a.start_time_utc, c.name as customer_name, s.name as service_name,
              p.name as provider_name, s.price
       FROM appointments a
       JOIN customers c ON a.customer_id = c.id
       JOIN services s ON a.service_id = s.id
       JOIN providers p ON a.provider_id = p.id
       ORDER BY a.start_time_utc DESC LIMIT 10`
    );
    res.json({
      metrics: {
        totalAppointments: parseInt(revResult.rows[0].total_appointments) || 0,
        totalRevenue:       parseFloat(revResult.rows[0].total_revenue)   || 0,
        totalCustomers:     parseInt(cusResult.rows[0].total_customers)   || 0,
        loyalCustomers:     parseInt(cusResult.rows[0].loyal_customers)   || 0,
      },
      recentAppointments: recentResult.rows,
    });
  } catch (error) {
    console.error('Error al obtener analíticas:', error.message);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Appointments Service corriendo en http://localhost:${PORT}`);
});
