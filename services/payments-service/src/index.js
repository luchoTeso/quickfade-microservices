require('./telemetry');
require('dotenv').config();
const crypto  = require('crypto');
const express = require('express');
const cors    = require('cors');
const amqp    = require('amqplib');
const axios   = require('axios');
const client  = require('prom-client');

const app = express();

const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000,http://127.0.0.1:3000').split(',');
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) cb(null, true);
    else cb(new Error('Not allowed by CORS'));
  },
}));

const PORT = process.env.PORT || 3003;

// Credenciales dLocal Go — configuralas en docker-compose o .env
// Obtené las credenciales sandbox en: https://dashboard-sandbox.dlocalgo.com
const DLOCAL_API_KEY    = process.env.DLOCAL_API_KEY;
const DLOCAL_SECRET_KEY = process.env.DLOCAL_SECRET_KEY;
const DLOCAL_BASE_URL   = process.env.DLOCAL_BASE_URL || 'https://api-sbx.dlocalgo.com';
const WEBHOOK_BASE_URL  = process.env.WEBHOOK_BASE_URL || 'http://localhost:8080';
const FRONTEND_URL      = process.env.FRONTEND_URL     || 'http://localhost:3000';

const realIntegration = !!(DLOCAL_API_KEY && DLOCAL_SECRET_KEY);
console.log(realIntegration
  ? '✅ dLocal Go: integración REAL activa (sandbox)'
  : '⚠️  dLocal Go: modo SIMULADO (set DLOCAL_API_KEY y DLOCAL_SECRET_KEY para usar real)'
);

// ========================================================
// PROMETHEUS — Métricas
// ========================================================
const register = new client.Registry();
client.collectDefaultMetrics({ register });

const paymentCounter = new client.Counter({
  name: 'payments_total',
  help: 'Total de pagos procesados',
  labelNames: ['status', 'currency'],
  registers: [register],
});

const webhookCounter = new client.Counter({
  name: 'webhooks_received_total',
  help: 'Total de webhooks recibidos',
  labelNames: ['status'],
  registers: [register],
});

// ========================================================
// RABBITMQ
// ========================================================
let channel = null;

async function connectRabbitMQ() {
  if (!process.env.RABBITMQ_URL) { console.warn('⚠️ RABBITMQ_URL no definida.'); return; }
  try {
    const connection = await amqp.connect(process.env.RABBITMQ_URL);
    channel = await connection.createChannel();

    await channel.assertExchange('turnos_dlx', 'direct', { durable: true });
    await channel.assertQueue('pagos_confirmados', {
      durable: true,
      arguments: {
        'x-dead-letter-exchange': 'turnos_dlx',
        'x-dead-letter-routing-key': 'pagos.dead',
      },
    });
    await channel.assertQueue('pagos_confirmados.dead', { durable: true });
    await channel.bindQueue('pagos_confirmados.dead', 'turnos_dlx', 'pagos.dead');

    console.log('✅ Payments Service conectado a RabbitMQ con DLQ.');

    connection.on('error', (err) => { console.error('❌ RabbitMQ error:', err.message); channel = null; });
    connection.on('close', () => {
      console.warn('⚠️ RabbitMQ cerrado. Reintentando en 5s...');
      channel = null;
      setTimeout(connectRabbitMQ, 5000);
    });
  } catch (error) {
    console.error('❌ Error conectando a RabbitMQ en payments-service:', error.message);
    setTimeout(connectRabbitMQ, 5000);
  }
}
connectRabbitMQ();

// ========================================================
// OBSERVABILIDAD
// ========================================================
app.get('/health', (req, res) => res.json({
  status: 'OK',
  service: 'payments-service',
  dlocal: realIntegration ? 'real' : 'simulado',
}));

app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

// ========================================================
// ENDPOINT: Generar Link de Pago (dLocal Go)
// ========================================================
app.use('/api/payments/checkout', express.json());

app.post('/api/payments/checkout', async (req, res) => {
  const { appointmentId, amount, currency, country, description, customerEmail } = req.body;

  if (!appointmentId || !amount)
    return res.status(400).json({ error: 'Faltan datos de la cita para el pago.' });

  try {
    if (realIntegration) {
      // ── Integración REAL con dLocal Go Sandbox ──────────────────────────────
      // Documentación: https://docs.dlocalgo.com/
      // Los campos exactos pueden variar según tu cuenta sandbox.
      const payload = {
        amount:           parseFloat(amount),
        currency:         currency,
        country:          country,
        description:      description || `Reserva QuickFade #${appointmentId}`,
        payer:            { email: customerEmail },
        notification_url: `${WEBHOOK_BASE_URL}/api/webhooks/payments`,
        success_url:      `${FRONTEND_URL}/gestion?appt=${appointmentId}`,
        back_url:         `${FRONTEND_URL}`,
        metadata:         { appointment_id: String(appointmentId) },
      };

      const response = await axios.post(`${DLOCAL_BASE_URL}/v1/payments`, payload, {
        headers: {
          'X-Date':      new Date().toISOString(),
          'X-Login':     DLOCAL_API_KEY,
          'X-Trans-Key': DLOCAL_SECRET_KEY,
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      });

      const data = response.data;
      paymentCounter.inc({ status: 'checkout_created', currency: currency || 'unknown' });

      return res.json({
        success:       true,
        checkoutUrl:   data.redirect_url || data.checkout_url || data.url,
        transactionId: data.id,
      });
    } else {
      // ── Modo SIMULADO (sin credenciales dLocal) ──────────────────────────────
      paymentCounter.inc({ status: 'checkout_simulated', currency: currency || 'unknown' });
      return res.json({
        success:       true,
        checkoutUrl:   `http://localhost:3000/simulador-dlocal?id=${appointmentId}&amount=${amount}&currency=${currency}`,
        transactionId: `tx_mock_${Date.now()}`,
      });
    }
  } catch (error) {
    console.error('❌ Error al generar checkout:', error.response?.data || error.message);
    paymentCounter.inc({ status: 'checkout_error', currency: currency || 'unknown' });
    res.status(500).json({ error: 'Error al contactar a la pasarela de pagos.' });
  }
});

// ========================================================
// ENDPOINT: Webhook dLocal Go — Confirmación de pago
//
// Validación HMAC-SHA256:
//   dLocal envía el header X-dLocal-Signature con la firma del cuerpo.
//   Calculamos HMAC-SHA256(DLOCAL_SECRET_KEY, rawBody) y comparamos.
//   Si no hay credenciales configuradas (modo simulado), se acepta cualquier webhook.
// ========================================================

// express.raw captura el body como Buffer para poder validar la firma antes de parsear
app.post('/api/webhooks/payments', express.raw({ type: '*/*' }), async (req, res) => {
  // Responder 200 inmediatamente para que dLocal no reintente
  res.status(200).send('OK');

  let payload;
  try {
    const rawBody = req.body instanceof Buffer ? req.body : Buffer.from(JSON.stringify(req.body));

    // ── Validación de firma HMAC-SHA256 ──────────────────────────────────────
    if (realIntegration) {
      const receivedSig = req.headers['x-dlocal-signature'];
      if (!receivedSig) {
        console.warn('⚠️ Webhook recibido sin firma X-dLocal-Signature — descartado.');
        webhookCounter.inc({ status: 'invalid_signature' });
        return;
      }
      const expectedSig = crypto
        .createHmac('sha256', DLOCAL_SECRET_KEY)
        .update(rawBody)
        .digest('hex');

      let sigValid = false;
      try {
        const rcvBuf = Buffer.from(receivedSig, 'hex');
        const expBuf = Buffer.from(expectedSig, 'hex');
        sigValid = rcvBuf.length === expBuf.length && crypto.timingSafeEqual(rcvBuf, expBuf);
      } catch { sigValid = false; }

      if (!sigValid) {
        console.warn('⚠️ Firma de webhook inválida — posible request fraudulenta.');
        webhookCounter.inc({ status: 'invalid_signature' });
        return;
      }
    }

    payload = JSON.parse(rawBody.toString());
    console.log('🔔 Webhook de pago recibido:', payload);
    webhookCounter.inc({ status: 'received' });

    // dLocal Go envía status "PAID" o "paid" según la versión de la API
    const status        = (payload.status || '').toUpperCase();
    const appointmentId = payload.appointment_id
      || payload.metadata?.appointment_id
      || payload.id;

    if (status === 'PAID' && appointmentId) {
      console.log(`✅ Pago PAID para cita #${appointmentId}. Publicando en RabbitMQ...`);
      if (channel) {
        channel.sendToQueue('pagos_confirmados', Buffer.from(JSON.stringify({
          action: 'PAYMENT_SUCCEEDED',
          appointmentId,
        })));
      }
      webhookCounter.inc({ status: 'payment_succeeded' });
    }
  } catch (err) {
    console.error('❌ Error procesando webhook:', err.message);
    webhookCounter.inc({ status: 'error' });
  }
});

app.listen(PORT, () => {
  console.log(`💰 Payments Service corriendo en http://localhost:${PORT}`);
});
