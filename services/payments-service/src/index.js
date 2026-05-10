require('dotenv').config();
const express = require('express');
const cors = require('cors');
const amqp = require('amqplib');

const app = express();
app.use(express.json());

// CORS Config
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000,http://127.0.0.1:3000').split(',');
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) cb(null, true);
    else cb(new Error('Not allowed by CORS'));
  },
}));

const PORT = process.env.PORT || 3003;

// RabbitMQ Connection
let channel = null;
async function connectRabbitMQ() {
  if (!process.env.RABBITMQ_URL) {
    console.warn('⚠️ RABBITMQ_URL no definida en payments-service.');
    return;
  }
  try {
    const connection = await amqp.connect(process.env.RABBITMQ_URL);
    channel = await connection.createChannel();
    await channel.assertQueue('pagos_confirmados', { durable: true });
    console.log('✅ Payments Service conectado a RabbitMQ.');
    
    connection.on('error', (err) => {
      console.error('❌ Conexión RabbitMQ perdida:', err.message);
      channel = null;
    });
    connection.on('close', () => {
      console.warn('⚠️ Conexión RabbitMQ cerrada. Reintentando en 5s...');
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
// ENDPOINT: Generar Link de Pago (dLocal Go)
// ========================================================
app.post('/api/payments/checkout', async (req, res) => {
  const { appointmentId, amount, currency, country, description, customerEmail } = req.body;

  if (!appointmentId || !amount) {
    return res.status(400).json({ error: 'Faltan datos de la cita para el pago.' });
  }

  try {
    // AQUÍ IRÍA LA LLAMADA REAL A LA API DE DLOCAL GO.
    // Por ahora, como estamos construyendo la arquitectura, 
    // simularemos que dLocal Go nos devuelve una URL de pago.
    
    const mockCheckoutUrl = `http://localhost:3000/simulador-dlocal?id=${appointmentId}&amount=${amount}&currency=${currency}`;
    
    res.json({
      success: true,
      checkoutUrl: mockCheckoutUrl,
      transactionId: `tx_mock_${Date.now()}`
    });

  } catch (error) {
    console.error('Error al generar checkout:', error);
    res.status(500).json({ error: 'Error al contactar a la pasarela de pagos.' });
  }
});

// ========================================================
// ENDPOINT: Webhook (Recibe confirmación de dLocal Go)
// ========================================================
app.post('/api/webhooks/payments', async (req, res) => {
  const payload = req.body;
  console.log('🔔 Webhook de pago recibido:', payload);

  // En dLocal Go real, aquí validarías la firma criptográfica para 
  // asegurar que el request realmente viene de dLocal Go y no de un hacker.

  // Simulamos que el payload tiene un "status: PAID" y un appointment_id
  const status = payload.status || 'PAID';
  const appointmentId = payload.appointment_id || payload.id;

  if (status === 'PAID' && appointmentId) {
    console.log(`✅ Pago confirmado para cita #${appointmentId}. Publicando en RabbitMQ...`);

    if (channel) {
      const eventData = {
        action: 'PAYMENT_SUCCEEDED',
        appointmentId: appointmentId
      };
      channel.sendToQueue('pagos_confirmados', Buffer.from(JSON.stringify(eventData)));
    }
  }

  // Siempre responder 200 OK rápido al Webhook para que la pasarela no reintente
  res.status(200).send('OK');
});

app.listen(PORT, () => {
  console.log(`💰 Payments Service corriendo en http://localhost:${PORT}`);
});
