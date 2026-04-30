require('dotenv').config();
const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());

// Health check del Gateway
app.get('/health', (req, res) => {
  res.json({ status: 'API Gateway Operativo', port: PORT });
});

// Enrutamiento a los microservicios
// Redirige todo el tráfico que empiece con /api al appointments-service
app.use('/api', createProxyMiddleware({ 
  target: process.env.APPOINTMENTS_SERVICE_URL || 'http://localhost:3001', 
  changeOrigin: true 
}));

app.listen(PORT, () => {
  console.log(`🌐 API Gateway escuchando en el puerto ${PORT}`);
  console.log(`🔀 Redirigiendo tráfico /api hacia http://localhost:3001`);
});
