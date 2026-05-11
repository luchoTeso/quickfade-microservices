require('./telemetry');
require('dotenv').config();
const http   = require('http');
const amqp   = require('amqplib');
const { Pool } = require('pg');
const client = require('prom-client');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

console.log('🚀 Iniciando Notifications Service...');

// ========================================================
// PROMETHEUS — Métricas + servidor HTTP para /health y /metrics
// (Este servicio es un worker sin Express, por eso usamos http nativo)
// ========================================================
const register = new client.Registry();
client.collectDefaultMetrics({ register });

const notificationsCounter = new client.Counter({
  name: 'notifications_sent_total',
  help: 'Total de notificaciones enviadas',
  labelNames: ['action', 'channel'],
  registers: [register],
});

const dlqCounter = new client.Counter({
  name: 'notifications_dlq_total',
  help: 'Mensajes enviados a Dead Letter Queue',
  registers: [register],
});

const HEALTH_PORT = process.env.HEALTH_PORT || 3004;

http.createServer(async (req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'OK', service: 'notifications-service' }));
  } else if (req.url === '/metrics') {
    res.writeHead(200, { 'Content-Type': register.contentType });
    res.end(await register.metrics());
  } else {
    res.writeHead(404);
    res.end();
  }
}).listen(HEALTH_PORT, () => {
  console.log(`📊 Health/Metrics endpoint en http://localhost:${HEALTH_PORT}`);
});

// ========================================================
// DEDUPLICACIÓN — evita procesar el mismo evento dos veces
// ========================================================
const processedEvents = new Set();
const MAX_PROCESSED_CACHE = 10000;

// ========================================================
// ENVÍO DE NOTIFICACIONES
// ========================================================
const sendWhatsApp = (phone, message) => {
  console.log('\n=========================================');
  console.log(`📱 WHATSAPP → ${phone}`);
  console.log('-----------------------------------------');
  console.log(message);
  console.log('=========================================\n');
};

const { Resend } = require('resend');
const resend = new Resend(process.env.RESEND_API_KEY);

const sendEmail = async (email, message) => {
  if (!email) return;
  if (process.env.RESEND_API_KEY) {
    try {
      const to = (process.env.NODE_ENV !== 'production' && process.env.TEST_EMAIL_RECIPIENT)
        ? process.env.TEST_EMAIL_RECIPIENT
        : email;
      const { data, error } = await resend.emails.send({
        from: 'QuickFade <onboarding@resend.dev>',
        to,
        subject: '💇‍♂️ Confirmación de tu Reserva - QuickFade',
        html: `<div style="font-family:sans-serif;padding:20px;background:#0D0D0D;color:white;border:1px solid #C9A84C;border-radius:10px;">
                 <h2 style="color:#C9A84C;">¡Turno Confirmado!</h2>
                 <p>${message}</p>
                 <p style="color:gray;font-size:12px;">Mensaje automatizado - QuickFade Microservices.</p>
               </div>`,
      });
      if (error) console.error('❌ Resend error:', error);
      else console.log(`✅ Correo enviado vía Resend. ID: ${data.id}`);
    } catch (err) {
      console.error('❌ Excepción enviando correo:', err.message);
      throw err; // Re-lanzar para que el mensaje vaya a DLQ
    }
  } else {
    console.log('\n=========================================');
    console.log(`📧 CORREO SIMULADO → ${email}`);
    console.log('-----------------------------------------');
    console.log(message);
    console.log('=========================================\n');
  }
};

// ========================================================
// WORKER — Consumidor RabbitMQ con DLQ
// ========================================================
async function startWorker() {
  if (!process.env.RABBITMQ_URL) {
    console.error('❌ RABBITMQ_URL no definida. Abortando.');
    return;
  }
  try {
    const connection = await amqp.connect(process.env.RABBITMQ_URL);
    const channel    = await connection.createChannel();

    // Dead Letter Exchange (debe existir o crearlo acá también)
    await channel.assertExchange('turnos_dlx', 'direct', { durable: true });

    const queue = 'citas_creadas';
    await channel.assertQueue(queue, {
      durable: true,
      arguments: {
        'x-dead-letter-exchange':   'turnos_dlx',
        'x-dead-letter-routing-key': 'citas.dead',
      },
    });
    // DLQ para monitoreo
    await channel.assertQueue('citas_creadas.dead', { durable: true });
    await channel.bindQueue('citas_creadas.dead', 'turnos_dlx', 'citas.dead');

    console.log(`🎧 Worker de notificaciones escuchando: ${queue}`);

    connection.on('error', (err) => console.error('❌ RabbitMQ error:', err.message));
    connection.on('close', () => {
      console.warn('⚠️ RabbitMQ cerrado. Reintentando en 5s...');
      setTimeout(startWorker, 5000);
    });

    channel.consume(queue, async (msg) => {
      if (!msg) return;
      try {
        const event = JSON.parse(msg.content.toString());
        console.log(`📨 Evento recibido: ${queue}`, event);

        // Deduplicación
        const eventKey = `${event.action}:${event.appointmentId}`;
        if (processedEvents.has(eventKey)) {
          console.log(`⚠️ Evento duplicado (${eventKey}), ignorando.`);
          channel.ack(msg);
          return;
        }
        processedEvents.add(eventKey);
        if (processedEvents.size > MAX_PROCESSED_CACHE) {
          const first = processedEvents.values().next().value;
          processedEvents.delete(first);
        }

        // Datos de la notificación
        const result = await pool.query(`
          SELECT c.name as customer_name, c.phone_number, c.email, c.preferred_locale,
                 s.name as service_name, b.name as business_name,
                 co.currency_symbol, co.name as country_name
          FROM customers c
          JOIN appointments a ON a.id = $1
          JOIN services s ON a.service_id = s.id
          JOIN businesses b ON s.business_id = b.id
          JOIN countries co ON b.country_code = co.code
          WHERE c.id = $2
        `, [event.appointmentId, event.customerId]);

        if (result.rows.length > 0) {
          const data = result.rows[0];
          const dateObj       = new Date(event.startTime);
          const formattedDate = dateObj.toLocaleDateString(data.preferred_locale);
          const formattedTime = dateObj.toLocaleTimeString(data.preferred_locale, { hour: '2-digit', minute: '2-digit' });
          const action        = event.action || 'CREATED';

          let waMsg = '', emailMsg = '';

          if (action === 'CREATED') {
            if (data.preferred_locale === 'fr') {
              waMsg    = `Salut ${data.customer_name} ! Votre rendez-vous pour ${data.service_name} chez ${data.business_name} est confirmé pour le ${formattedDate} à ${formattedTime}. ID: #${event.appointmentId}`;
              emailMsg = `Rendez-vous confirmé. Merci d'avoir choisi QuickFade ${data.country_name}.`;
            } else if (data.preferred_locale === 'en') {
              waMsg    = `Hi ${data.customer_name}! Your appointment for ${data.service_name} at ${data.business_name} is confirmed for ${formattedDate} at ${formattedTime}. ID: #${event.appointmentId}`;
              emailMsg = `Appointment confirmed. Thanks for choosing QuickFade ${data.country_name}.`;
            } else {
              waMsg    = `¡Hola ${data.customer_name}! Tu cita para ${data.service_name} en ${data.business_name} está confirmada para el ${formattedDate} a las ${formattedTime}. ID: #${event.appointmentId}`;
              emailMsg = `Cita confirmada. Gracias por elegir QuickFade ${data.country_name}.`;
            }
          } else if (action === 'RESCHEDULED') {
            if (data.preferred_locale === 'fr') {
              waMsg    = `Salut ${data.customer_name} ! Votre rendez-vous a été reprogrammé pour le ${formattedDate} à ${formattedTime}. ID: #${event.appointmentId}`;
              emailMsg = `Rendez-vous reprogrammé avec succès.`;
            } else if (data.preferred_locale === 'en') {
              waMsg    = `Hi ${data.customer_name}! Your appointment has been rescheduled to ${formattedDate} at ${formattedTime}. ID: #${event.appointmentId}`;
              emailMsg = `Appointment rescheduled successfully.`;
            } else {
              waMsg    = `¡Hola ${data.customer_name}! Tu cita ha sido reprogramada para el ${formattedDate} a las ${formattedTime}. ID: #${event.appointmentId}`;
              emailMsg = `Cita reprogramada exitosamente.`;
            }
          } else if (action === 'CANCELLED') {
            if (data.preferred_locale === 'fr') {
              waMsg    = `Salut ${data.customer_name}. Votre rendez-vous (ID: #${event.appointmentId}) a été annulé.`;
              emailMsg = `Annulation de rendez-vous confirmée.`;
            } else if (data.preferred_locale === 'en') {
              waMsg    = `Hi ${data.customer_name}. Your appointment (ID: #${event.appointmentId}) has been cancelled.`;
              emailMsg = `Appointment cancellation confirmed.`;
            } else {
              waMsg    = `¡Hola ${data.customer_name}. Tu cita (ID: #${event.appointmentId}) ha sido cancelada.`;
              emailMsg = `Cancelación de cita confirmada.`;
            }
          }

          sendWhatsApp(data.phone_number, waMsg);
          await sendEmail(data.email, emailMsg);
          notificationsCounter.inc({ action, channel: 'email' });
          notificationsCounter.inc({ action, channel: 'whatsapp' });
        }

        channel.ack(msg);
      } catch (err) {
        console.error('❌ Error procesando mensaje:', err.message);
        // NACK sin requeue → va a citas_creadas.dead (DLQ)
        channel.nack(msg, false, false);
        dlqCounter.inc();
      }
    });
  } catch (error) {
    console.error('❌ Error conectando a RabbitMQ:', error.message);
    setTimeout(startWorker, 5000);
  }
}

startWorker();
