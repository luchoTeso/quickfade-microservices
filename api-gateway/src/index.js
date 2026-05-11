require('./telemetry');
require('dotenv').config();
const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const cors = require('cors');
const { rateLimit } = require('express-rate-limit');
const client = require('prom-client');

const app = express();
const PORT         = process.env.PORT           || 8080;
const BACKEND_URL  = process.env.APPOINTMENTS_SERVICE_URL || 'http://localhost:3001';
const PAYMENTS_URL = process.env.PAYMENTS_SERVICE_URL     || 'http://localhost:3003';

// ========================================================
// PROMETHEUS
// ========================================================
const register = new client.Registry();
client.collectDefaultMetrics({ register });

const httpDuration = new client.Histogram({
  name: 'gateway_http_request_duration_seconds',
  help: 'Duración de requests en el API Gateway',
  labelNames: ['method', 'path', 'status'],
  registers: [register],
});

const proxiedRequests = new client.Counter({
  name: 'gateway_proxied_requests_total',
  help: 'Total de requests proxeadas por destino',
  labelNames: ['target'],
  registers: [register],
});

// ========================================================
// CORS
// ========================================================
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000,http://127.0.0.1:3000').split(',');
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) cb(null, true);
    else cb(new Error('Not allowed by CORS'));
  },
}));

// Métricas de duración en el gateway
app.use((req, res, next) => {
  const end = httpDuration.startTimer({ method: req.method, path: req.path });
  res.on('finish', () => end({ status: res.statusCode }));
  next();
});

// ========================================================
// RATE LIMITING
// ========================================================
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Has superado el límite de peticiones. Intenta más tarde.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const bookingLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { error: 'Límite de reservas excedido. Contacta soporte si necesitás agendar más.' },
});

app.use(globalLimiter);

// ========================================================
// OBSERVABILIDAD
// ========================================================
app.get('/health', (req, res) => res.json({
  status: 'API Gateway Operativo',
  port: PORT,
  protections: 'Rate Limiting Activo',
  upstreamAppointments: BACKEND_URL,
  upstreamPayments: PAYMENTS_URL,
}));

app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

// ========================================================
// PROXY
// ========================================================
app.post('/api/appointments', bookingLimiter, (req, res, next) => next());

// Proxy a payments-service
const paymentsProxy = createProxyMiddleware({
  target: PAYMENTS_URL,
  changeOrigin: true,
  pathFilter: (path) => path.startsWith('/api/payments') || path.startsWith('/api/webhooks'),
  on: {
    proxyReq: () => proxiedRequests.inc({ target: 'payments-service' }),
  },
});
app.use(paymentsProxy);

// Proxy a appointments-service
const apiProxy = createProxyMiddleware({
  target: BACKEND_URL,
  changeOrigin: true,
  pathFilter: (path) =>
    path.startsWith('/api/') && !path.startsWith('/api/payments') && !path.startsWith('/api/webhooks'),
  on: {
    proxyReq: () => proxiedRequests.inc({ target: 'appointments-service' }),
  },
});
app.use(apiProxy);

app.listen(PORT, () => {
  console.log(`🌐 API Gateway escuchando en puerto ${PORT}`);
  console.log(`🔀 Turnos → ${BACKEND_URL}`);
  console.log(`💰 Pagos  → ${PAYMENTS_URL}`);
});
