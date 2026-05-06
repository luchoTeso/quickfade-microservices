require('dotenv').config();
const amqp = require('amqplib');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

console.log('🚀 Iniciando Notifications Service...');

// Funciones para enviar notificaciones simuladas
const sendWhatsApp = (phone, message) => {
  console.log('\n=========================================');
  console.log(`📱 ENVIANDO WHATSAPP A: ${phone}`);
  console.log('-----------------------------------------');
  console.log(message);
  console.log('=========================================\n');
};

const { Resend } = require('resend');
const resend = new Resend(process.env.RESEND_API_KEY); // Usa la llave del .env

const sendEmail = async (email, message) => {
  if (!email) return;

  if (process.env.RESEND_API_KEY) {
    try {
      const { data, error } = await resend.emails.send({
        from: 'QuickFade <onboarding@resend.dev>', // Resend permite usar este correo en la capa gratuita
        // Resend capa gratuita: Solo permite enviar al correo registrado.
        // Si tienes dominio verificado, borrará esto y usará solo 'email'.
        to: (process.env.NODE_ENV !== 'production' && process.env.TEST_EMAIL_RECIPIENT)
              ? process.env.TEST_EMAIL_RECIPIENT
              : email,
        subject: '💇‍♂️ Confirmación de tu Reserva - QuickFade',
        html: `<div style="font-family: sans-serif; padding: 20px; background-color: #0D0D0D; color: white; border: 1px solid #C9A84C; border-radius: 10px;">
                 <h2 style="color: #C9A84C;">¡Turno Confirmado!</h2>
                 <p>${message}</p>
                 <br>
                 <p style="color: gray; font-size: 12px;">Mensaje automatizado generado por la arquitectura de microservicios de QuickFade.</p>
               </div>`
      });

      if (error) {
        console.error('❌ Resend rechazó el envío. Motivo:', error);
      } else {
        console.log(`✅ Correo real enviado con éxito vía Resend. ID: ${data.id}`);
      }
    } catch (err) {
      console.error('❌ Excepción enviando Correo Real:', err.message);
    }
  } else {
    // Modo simulación si no hay llave
    console.log('\n=========================================');
    console.log(`📧 ENVIANDO CORREO SIMULADO A: ${email}`);
    console.log('-----------------------------------------');
    console.log(message);
    console.log('=========================================\n');
  }
};

// Trabajador de RabbitMQ
async function startWorker() {
  try {
    if (!process.env.RABBITMQ_URL) {
      console.error('❌ RABBITMQ_URL no está definida en .env. Abortando.');
      return;
    }
    const connection = await amqp.connect(process.env.RABBITMQ_URL);
    const channel = await connection.createChannel();

    const queue = 'citas_creadas';
    await channel.assertQueue(queue, { durable: true });

    console.log(`🎧 Worker de notificaciones escuchando en la cola: ${queue}`);

    channel.consume(queue, async (msg) => {
      if (msg !== null) {
        try {
          const event = JSON.parse(msg.content.toString());
          console.log(`📨 Recibido evento: ${queue}`, event);

          // Consultar datos adicionales necesarios para la notificación (Cliente y Servicio)
          const query = `
            SELECT 
              c.name as customer_name, c.phone_number, c.email, c.preferred_locale,
              s.name as service_name, b.name as business_name, co.currency_symbol, co.name as country_name
            FROM customers c
            JOIN appointments a ON a.id = $1
            JOIN services s ON a.service_id = s.id
            JOIN businesses b ON s.business_id = b.id
            JOIN countries co ON b.country_code = co.code
            WHERE c.id = $2;
          `;
          const result = await pool.query(query, [event.appointmentId, event.customerId]);

          if (result.rows.length > 0) {
            const data = result.rows[0];
            const dateObj = new Date(event.startTime);
            const formattedDate = dateObj.toLocaleDateString(data.preferred_locale);
            const formattedTime = dateObj.toLocaleTimeString(data.preferred_locale, { hour: '2-digit', minute: '2-digit' });

            // Plantillas i18n según la acción (CREATED, RESCHEDULED, CANCELLED)
            let waMsg = '';
            let emailMsg = '';
            const action = event.action || 'CREATED';

            if (action === 'CREATED') {
              if (data.preferred_locale === 'fr') {
                waMsg = `Salut ${data.customer_name} ! Votre rendez-vous pour ${data.service_name} chez ${data.business_name} est confirmé pour le ${formattedDate} à ${formattedTime}. ID: #${event.appointmentId}`;
                emailMsg = `Rendez-vous confirmé. Merci d'avoir choisi QuickFade ${data.country_name}.`;
              } else if (data.preferred_locale === 'en') {
                waMsg = `Hi ${data.customer_name}! Your appointment for ${data.service_name} at ${data.business_name} is confirmed for ${formattedDate} at ${formattedTime}. ID: #${event.appointmentId}`;
                emailMsg = `Appointment confirmed. Thanks for choosing QuickFade ${data.country_name}.`;
              } else {
                waMsg = `¡Hola ${data.customer_name}! Tu cita para ${data.service_name} en ${data.business_name} está confirmada para el ${formattedDate} a las ${formattedTime}. ID: #${event.appointmentId}`;
                emailMsg = `Cita confirmada exitosamente. Gracias por elegir QuickFade ${data.country_name}.`;
              }
            } else if (action === 'RESCHEDULED') {
              if (data.preferred_locale === 'fr') {
                waMsg = `Salut ${data.customer_name} ! Votre rendez-vous a été reprogrammé pour le ${formattedDate} à ${formattedTime}. ID: #${event.appointmentId}`;
                emailMsg = `Rendez-vous reprogrammé avec succès.`;
              } else if (data.preferred_locale === 'en') {
                waMsg = `Hi ${data.customer_name}! Your appointment has been rescheduled to ${formattedDate} at ${formattedTime}. ID: #${event.appointmentId}`;
                emailMsg = `Appointment rescheduled successfully.`;
              } else {
                waMsg = `¡Hola ${data.customer_name}! Tu cita ha sido reprogramada para el ${formattedDate} a las ${formattedTime}. ID: #${event.appointmentId}`;
                emailMsg = `Cita reprogramada exitosamente.`;
              }
            } else if (action === 'CANCELLED') {
              if (data.preferred_locale === 'fr') {
                waMsg = `Salut ${data.customer_name}. Votre rendez-vous (ID: #${event.appointmentId}) a été annulé.`;
                emailMsg = `Annulation de rendez-vous confirmée.`;
              } else if (data.preferred_locale === 'en') {
                waMsg = `Hi ${data.customer_name}. Your appointment (ID: #${event.appointmentId}) has been cancelled.`;
                emailMsg = `Appointment cancellation confirmed.`;
              } else {
                waMsg = `¡Hola ${data.customer_name}. Tu cita (ID: #${event.appointmentId}) ha sido cancelada exitosamente.`;
                emailMsg = `Cancelación de cita confirmada.`;
              }
            }

            // Simular envío
            sendWhatsApp(data.phone_number, waMsg);
            sendEmail(data.email, emailMsg);
          }

          // Confirmar que procesamos el mensaje (Acknowledge)
          channel.ack(msg);
        } catch (err) {
          console.error('Error procesando el mensaje:', err);
          // Si hay error lógico (no de BD), lo descartamos para que no se cicle eternamente,
          // o usamos NACK para enviarlo a una Dead Letter Queue.
          channel.nack(msg, false, false);
        }
      }
    });
  } catch (error) {
    console.error('❌ Error conectando a RabbitMQ:', error.message);
    setTimeout(startWorker, 5000); // Reintentar conexión
  }
}

startWorker();
