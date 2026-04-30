Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "🚀 Iniciando Entorno de Desarrollo QuickFade" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan

# Usamos npx para ejecutar concurrently sin tener que instalarlo globalmente
npx concurrently -c "cyan.bold,blue.bold,magenta.bold,green.bold" -n "GATEWAY,APPOINTMENTS,NOTIFICATIONS,FRONTEND" "cd api-gateway && npm run dev" "cd services/appointments-service && npm run dev" "cd services/notifications-service && npm run dev" "cd client-app && npm run dev"
