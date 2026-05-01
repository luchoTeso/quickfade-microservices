# ✂️ QuickFade - Sistema de Turnos y Reservas (Microservicios)

¡Bienvenido al repositorio de QuickFade! Este proyecto es una solución completa y profesional para el agendamiento de citas, construido sobre una arquitectura de **microservicios distribuidos**.

## 🏗️ Arquitectura del Sistema
- **Frontend:** Next.js (React) + TailwindCSS
- **API Gateway:** Node.js + Express (Rate Limiting + Proxy)
- **Appointments Service:** Node.js (Gestión de citas, concurrencia, BD)
- **Notifications Service:** Worker asíncrono (Consumo de colas para Emails/WhatsApp)
- **Infraestructura (Docker):**
  - **PostgreSQL:** Base de datos relacional (ACID).
  - **Redis:** Sistema de bloqueos distribuidos temporales (Locks).
  - **RabbitMQ:** Cola de mensajes asíncrona para comunicación entre servicios.

---

## ⚙️ Requisitos Previos
Para ejecutar este proyecto en tu máquina local, necesitas tener instalado:
1. **Node.js** (Versión 18 o superior).
2. **Docker Desktop** (Asegúrate de que el motor de Docker esté corriendo).
3. **Git** (Para clonar el repositorio).

---

## 🚀 Guía de Instalación (Entorno de Desarrollo)

Sigue estos pasos en orden para levantar el proyecto localmente sin errores:

### 1. Clonar el repositorio
```bash
git clone <url-de-tu-repositorio>
cd "Sistema de Turnos y reservas"
```

### 2. Configurar Variables de Entorno (.env)
Debes crear/verificar la existencia de dos archivos `.env` en los microservicios:

**A. `services/appointments-service/.env`**
```env
PORT=3001
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/turnos_reservas
REDIS_URL=redis://localhost:6379
RABBITMQ_URL=amqp://localhost:5672
```

**B. `services/notifications-service/.env`**
```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/turnos_reservas
RABBITMQ_URL=amqp://localhost:5672
RESEND_API_KEY=re_tu_api_key_de_resend_aqui
TEST_EMAIL_RECIPIENT=tu_correo_de_prueba@gmail.com
```

### 3. Instalar Dependencias
Para evitar instalar carpeta por carpeta, puedes ejecutar este comando desde la raíz (PowerShell):
```powershell
npm run install --prefix api-gateway; npm run install --prefix client-app; npm run install --prefix services/appointments-service; npm run install --prefix services/notifications-service
```
*(Alternativamente, entra a cada carpeta y ejecuta `npm install`).*

### 4. Levantar la Infraestructura (Docker)
Antes de encender el código, debemos encender la Base de Datos, Redis y RabbitMQ.
Ejecuta en la consola (en la raíz del proyecto):
```bash
docker-compose up -d postgres redis rabbitmq
```
> **Nota:** La primera vez que se ejecute, PostgreSQL leerá automáticamente el archivo `infrastructure/init.sql` y creará todas las tablas y datos de prueba.

### 5. Iniciar los Microservicios
Una vez que los contenedores estén listos, arranca todos los servicios de Node.js y Next.js con el script maestro:
```powershell
.\start-dev.ps1
```

¡Listo! Tu consola mostrará los 4 servicios corriendo simultáneamente.

---

## 🌐 URLs de Acceso

- **Frontend (UI Principal):** [http://localhost:3000](http://localhost:3000)
- **Gestión de Citas:** [http://localhost:3000/gestion](http://localhost:3000/gestion)
- **Panel Administrativo:** [http://localhost:3000/admin](http://localhost:3000/admin)
- **API Gateway (Punto de entrada):** [http://localhost:8080/health](http://localhost:8080/health)

---

## ⚠️ Solución de Problemas Comunes

- **Base de datos vacía (Error al cargar servicios):**
  Si por alguna razón detuviste Docker y borraste los volúmenes, la base de datos estará vacía. Para re-inicializarla:
  ```bash
  docker-compose down -v
  docker-compose up -d postgres redis rabbitmq
  ```
- **Error de Proxy (504):** Verifica que el archivo `start-dev.ps1` no haya fallado en levantar el `appointments-service` y que los puertos (8080, 3001, 3000) estén libres antes de correr el script.

---
*Desarrollado para demostración de Arquitectura de Microservicios.*
