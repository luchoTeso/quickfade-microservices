# Plan: Corrección de 7 hallazgos críticos en QuickFade

## Context

Tras una revisión exhaustiva del repo se identificaron 7 problemas críticos que afectan seguridad, corrección funcional y privacidad. Este plan los aborda en un orden que minimiza dependencias entre cambios y se puede ejecutar como una sola tanda de PRs (o uno solo). El objetivo es dejar el sistema en estado seguro y correcto sin convertirlo en un producto enterprise — se respeta la naturaleza académica/PoC del proyecto.

Los 7 issues que se corregirán:

1. Sin auth/autorización en endpoints de cita
2. Bug de zona horaria en `/api/availability`
3. `TEST_EMAIL_RECIPIENT` redirige todos los correos
4. Race condition en `/api/customers/lookup`
5. CORS abierto en gateway y appointments-service
6. `/api/appointments/:id/reschedule` sin validaciones
7. Cross-business: `business_id` no validado contra `service`/`provider`

---

## Cambios por archivo

### A. [infrastructure/init.sql](infrastructure/init.sql) — Soporte para token de acceso

Añadir columna `access_token` a `appointments` para implementar ownership simple sin sistema de usuarios.

```sql
-- Después de la definición de la tabla appointments
ALTER TABLE appointments ADD COLUMN access_token VARCHAR(40);
CREATE INDEX idx_appointments_token ON appointments(access_token);
```

Como `init.sql` solo corre en BD vacía, hay que añadirlo dentro del `CREATE TABLE appointments` directamente (en una columna `access_token VARCHAR(40)`). Para entornos con datos existentes se proporciona un script de migración separado en `infrastructure/migrations/001_add_access_token.sql`.

### B. [services/appointments-service/src/index.js](services/appointments-service/src/index.js)

**Issue 1 — Auth básica vía token de cita:**
- En `POST /api/appointments`: generar `access_token = crypto.randomUUID()` (o `crypto.randomBytes(20).toString('hex')`), persistirlo, devolverlo en la respuesta.
- En `GET/PUT /api/appointments/:id`: requerir header `X-Appointment-Token` o query `?token=`. Si no coincide → `403`. El admin/analytics puede protegerse con un secret simple en variable `ADMIN_TOKEN` por ahora.
- Reusar el helper `validateAppointmentToken(req, res, next)` como middleware en los 3 endpoints (`/:id`, `/:id/reschedule`, `/:id/cancel`).

**Issue 2 — Bug zona horaria en availability:**
- Aceptar `?timezone=America/Bogota` (o derivarlo del `business`) en `GET /api/availability`.
- Cambiar la query a:
  ```sql
  SELECT to_char(start_time_utc AT TIME ZONE $3, 'HH24:MI') as local_time
  FROM appointments
  WHERE provider_id = $1
    AND (start_time_utc AT TIME ZONE $3)::date = $2::date
    AND status IN ('confirmed','pending');
  ```
- Eliminar el `d.toISOString().substring(11,16)` que asume UTC.
- En cliente: enviar la timezone derivada del `country` seleccionado (ya existe en `COUNTRIES[country]`, hay que añadir `tz: 'America/Bogota'` etc.).

**Issue 4 — Race en lookup:**
- Reemplazar el flujo `SELECT → INSERT` por:
  ```sql
  INSERT INTO customers (name, phone_number, email, preferred_locale)
  VALUES ($1, $2, $3, $4)
  ON CONFLICT (phone_number) DO UPDATE
    SET email = COALESCE(customers.email, EXCLUDED.email)
  RETURNING id, visit_count, has_free_appointment;
  ```
- La lógica de `% 7 === 0 → has_free` se mueve a un `UPDATE` posterior si aplica (idempotente).

**Issue 6 — Validaciones en reschedule:**
Añadir antes del `UPDATE`:
- `new Date(newStartTime) > new Date()` (no en pasado).
- `new Date(newEndTime) > new Date(newStartTime)`.
- Hora local del `newStartTime` (en TZ del business) dentro de horario comercial — reusar la misma lista `BUSINESS_HOURS` que availability.
- Devolver `400` con mensaje claro si falla.

**Issue 7 — Cross-business validation:**
En `POST /api/appointments`, después del check actual de `provider_services`, añadir:
```sql
SELECT 1 FROM services s
JOIN providers p ON p.business_id = s.business_id
WHERE s.id = $1 AND p.id = $2 AND s.business_id = $3;
```
Si no hay match → `400`. Con esto se garantiza que `business_id` enviado por el cliente coincide con el del service y del provider.

### C. [api-gateway/src/index.js](api-gateway/src/index.js)

**Issue 5 — CORS con whitelist:**
```js
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000').split(',');
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) cb(null, true);
    else cb(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));
```

(Aplicar el mismo patrón en `appointments-service` por defensa en profundidad.)

### D. [services/notifications-service/src/index.js](services/notifications-service/src/index.js)

**Issue 3 — TEST_EMAIL_RECIPIENT:**
```js
const recipient = (process.env.NODE_ENV !== 'production' && process.env.TEST_EMAIL_RECIPIENT)
  ? process.env.TEST_EMAIL_RECIPIENT
  : email;
```
Solo aplica el override en desarrollo. En producción el correo va al cliente real.

### E. [docker-compose.yml](docker-compose.yml)

- Eliminar (o comentar) la línea `TEST_EMAIL_RECIPIENT: ldiuchep@ucentral.edu.co` del bloque `notifications-service` y dejar instrucción en `.env.example`.
- Añadir `NODE_ENV=development` explícito al servicio.
- Añadir `ALLOWED_ORIGINS=http://localhost:3000` al api-gateway y appointments-service.

### F. [client-app/src/app/page.jsx](client-app/src/app/page.jsx) y [client-app/src/app/gestion/page.jsx](client-app/src/app/gestion/page.jsx)

- Tras crear cita, capturar `data.appointment.access_token` y mostrarlo al usuario (junto con el `bookingId`). Persistir en `localStorage` para que `/gestion` lo recupere automáticamente, o pedirlo explícitamente en el formulario de búsqueda.
- Pasar `X-Appointment-Token` en `GET /api/appointments/:id`, `PUT .../cancel`, `PUT .../reschedule`.
- Añadir `tz` al objeto `COUNTRIES`:
  ```js
  CO: { ..., tz: 'America/Bogota' }
  FR: { ..., tz: 'Europe/Paris' }
  // etc, ya existen en init.sql countries.timezone
  ```
  Pasar `&timezone=${COUNTRIES[country].tz}` en `fetchAvailability`.

---

## Critical files

- [services/appointments-service/src/index.js](services/appointments-service/src/index.js) — núcleo de los cambios (issues 1, 2, 4, 6, 7).
- [api-gateway/src/index.js](api-gateway/src/index.js) — issue 5.
- [services/notifications-service/src/index.js](services/notifications-service/src/index.js) — issue 3.
- [infrastructure/init.sql](infrastructure/init.sql) — schema para issue 1.
- [docker-compose.yml](docker-compose.yml) — variables de entorno para issues 3, 5.
- [client-app/src/app/page.jsx](client-app/src/app/page.jsx), [client-app/src/app/gestion/page.jsx](client-app/src/app/gestion/page.jsx) — propagar token y timezone.

## Funciones/utilidades a reusar

- `crypto` (built-in Node) para generar tokens — sin nueva dependencia.
- `cors` con configuración options — ya está instalada.
- `pool.query` con `pg` — ya está integrado.
- `BUSINESS_HOURS = ['09:00',...,'17:00']` ya existe en `availability` ([appointments-service/src/index.js:224](services/appointments-service/src/index.js:224)) — extraer a constante exportada y reusar en `reschedule`.

---

## Verificación end-to-end

1. **Bajar y recrear infra** (si se modificó `init.sql`):
   ```bash
   docker-compose down -v
   docker-compose up -d postgres redis rabbitmq
   ```

2. **Issue 1 (Auth):**
   - Crear cita → obtener `access_token` en respuesta.
   - `GET /api/appointments/:id` SIN token → 403.
   - CON token correcto → 200.
   - CON token de otra cita → 403.

3. **Issue 2 (Timezone):**
   - Crear cita CO a las 09:00 local. Verificar en BD que `start_time_utc` es 14:00 UTC.
   - `GET /api/availability?providerId=X&date=YYYY-MM-DD&timezone=America/Bogota` → el slot `09:00` debe aparecer ocupado, no en otra hora.
   - Repetir con JP (UTC+9): cita a las 10:00 JP debe verse como `10:00` ocupado en disponibilidad JP.

4. **Issue 3 (TEST_EMAIL):**
   - Con `NODE_ENV=production` y `TEST_EMAIL_RECIPIENT=foo@x.com`: correo va al cliente real.
   - Con `NODE_ENV=development` y la misma var: correo va a `foo@x.com`.

5. **Issue 4 (Lookup race):**
   - Lanzar dos requests concurrentes a `/api/customers/lookup` con el mismo `phone_number`:
     ```bash
     for i in 1 2 3 4 5; do curl -X POST ... & done; wait
     ```
     Todos deben responder 200, no 500.

6. **Issue 5 (CORS):**
   - `curl -H "Origin: http://malicious.com" http://localhost:8080/api/services/CO -v` → header `access-control-allow-origin` ausente o request rechazado.
   - Mismo con `Origin: http://localhost:3000` → permitido.

7. **Issue 6 (Reschedule validations):**
   - PUT con `newStartTime` en el pasado → 400.
   - PUT con `newEndTime <= newStartTime` → 400.
   - PUT con hora 03:00 AM → 400 (fuera de horario comercial).
   - PUT válido → 200.

8. **Issue 7 (Cross-business):**
   - POST con `business_id: 1` y `service_id: 5` (Francia) → 400.
   - POST con `business_id: 1` y `service_id: 1` → 200.

9. **Smoke test del flujo completo:**
   - Crear cita en `/` → verla en `/gestion` → reprogramar → cancelar.
   - Verificar que el worker imprime los 3 mensajes (CREATED, RESCHEDULED, CANCELLED) y envía el email correcto.

10. **Lint/build:**
    - `npm run build` en `client-app` para verificar que el frontend compila.
    - Los servicios Node arrancan sin errores con `start-dev.ps1`.
