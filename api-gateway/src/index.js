require('dotenv').config();
const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const cors = require('cors');

const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());

// Limitador global: Máximo 100 peticiones cada 15 minutos por IP
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 100, 
  message: { error: 'Has superado el límite de peticiones. Intenta de nuevo más tarde.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Limitador estricto para creación de citas (prevenir spam)
const bookingLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 5, // Solo 5 reservas por hora por IP
  message: { error: 'Límite de reservas excedido. Por favor contacta soporte si necesitas agendar más.' },
});

app.use(globalLimiter);

// Health check del Gateway
app.get('/health', (req, res) => {
  res.json({ status: 'API Gateway Operativo', port: PORT, protections: 'Rate Limiting Activo' });
});

// Enrutamiento a los microservicios
// Redirige todo el tráfico que empiece con /api al appointments-service
app.use('/api/appointments', bookingLimiter); // Aplica protección estricta a la ruta de POST citas
app.use('/api', createProxyMiddleware({ 
  target: process.env.APPOINTMENTS_SERVICE_URL || 'http://localhost:3001', 
  changeOrigin: true 
}));

app.listen(PORT, () => {
  console.log(`🌐 API Gateway escuchando en el puerto ${PORT}`);
  console.log(`🔀 Redirigiendo tráfico /api hacia http://localhost:3001`);
});
