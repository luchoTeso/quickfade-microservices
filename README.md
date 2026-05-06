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

## 🚀 Guía de Instalación

Existen dos formas de correr este proyecto. Elige la que mejor se adapte a lo que necesitas hacer:

### 🌟 Modo 1: Todo en Docker (Recomendado para probar / Producción)
Usa este modo si solo quieres levantar el proyecto completo sin instalar Node.js localmente ni usar scripts.

1. **Clona el repositorio**
   ```bash
   git clone <url-de-tu-repositorio>
   cd "Sistema de Turnos y reservas"
   ```
2. **Levanta todo el ecosistema (Infraestructura + Microservicios)**
   ```powershell
   docker-compose up -d --build
   ```
   *Nota: La primera vez descargará todas las imágenes y PostgreSQL creará la base de datos con el archivo `infrastructure/init.sql`.*

3. ¡Listo! Ve a **[http://localhost:3000](http://localhost:3000)** en tu navegador.


### 💻 Modo 2: Modo Desarrollo Local (Para programar con Hot-Reload)
Usa este modo si vas a modificar el código y necesitas que los cambios se reflejen en tiempo real.

1. **Clona el repositorio e instala las dependencias** (Requiere Node.js)
   ```powershell
   npm run install --prefix api-gateway; npm run install --prefix client-app; npm run install --prefix services/appointments-service; npm run install --prefix services/notifications-service
   ```
2. **Levanta SOLO la infraestructura en Docker** (BD, Redis, Colas)
   ```powershell
   docker-compose up -d postgres redis rabbitmq
   ```
   *(Asegúrate de NO tener los demás contenedores corriendo para evitar conflictos de puertos).*
3. **Inicia los servidores de código**
   ```powershell
   .\start-dev.ps1
   ```
4. Abre **[http://localhost:3000](http://localhost:3000)** en tu navegador.

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
