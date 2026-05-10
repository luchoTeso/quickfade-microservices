/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    // Issue 19: Centralizar la URL del API para facilitar despliegue
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080',
  },
};
 
module.exports = nextConfig;
