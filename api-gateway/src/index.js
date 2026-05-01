require('dotenv').config();
const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const cors = require('cors');
const { rateLimit } = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 8080;

const BACKEND_URL = process.env.APPOINTMENTS_SERVICE_URL || 'http://127.0.0.1:3001';

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

// Aplicar rate limiting estricto solo a POST de citas
app.use('/api/appointments', bookingLimiter);

// Proxy: redirige todo /api/* al backend, preservando el path completo.
// Se monta en '/' con pathFilter para evitar que Express elimine el prefijo '/api'.
const apiProxy = createProxyMiddleware({
  target: BACKEND_URL,
  changeOrigin: true,
  pathFilter: '/api/**',
});
app.use(apiProxy);

app.listen(PORT, () => {
  console.log(`🌐 API Gateway escuchando en el puerto ${PORT}`);
  console.log(`🔀 Redirigiendo tráfico /api/* hacia ${BACKEND_URL}`);
});

