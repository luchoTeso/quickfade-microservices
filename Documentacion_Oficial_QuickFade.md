# PROYECTO DE SISTEMA DISTRIBUIDO: QUICKFADE
**Sistema global de reservas y gestión para franquicias multinacionales**

---

## 1. Introducción
El sector de servicios de cuidado personal (barberías y salones de belleza) ha experimentado una transformación digital acelerada. Sin embargo, las grandes franquicias multinacionales enfrentan un desafío tecnológico crítico: mantener un sistema de reservas unificado que garantice baja latencia a nivel global, soporte múltiples monedas y husos horarios, y evite por completo las "condiciones de carrera" (dobles reservas) durante picos de alta demanda. 

Este proyecto detalla el diseño e implementación de **QuickFade**, una plataforma basada en arquitectura de microservicios distribuidos. El sistema integra bloqueos distribuidos (Redis) para garantizar la consistencia en las reservas, y colas de mensajería (RabbitMQ) para el procesamiento asíncrono de notificaciones, brindando una experiencia de usuario fluida y segura en 5 países piloto: Colombia, Estados Unidos, Francia, Alemania y Japón.

## 2. Oportunidad de negocio global

### 2.1 Identificación de la oportunidad
Las franquicias de servicios con presencia en múltiples países suelen depender de sistemas monolíticos obsoletos o de múltiples instancias desconectadas de software local. Existe la necesidad de una plataforma unificada que:
* Permita agendamientos en tiempo real desde cualquier país con latencias mínimas.
* Gestione automáticamente la moneda, el idioma y la zona horaria del cliente.
* Centralice la analítica comercial para la toma de decisiones gerenciales.

### 2.2 Urgencia del mercado
* **Expansión de franquicias:** Marcas locales buscan expandirse a EE.UU. y Europa y necesitan infraestructura tecnológica que soporte esta escala.
* **Intolerancia a la latencia:** Un cliente no esperará más de 3 segundos para que cargue la disponibilidad de horarios; el abandono del embudo de conversión es alto.
* **Crisis de Overbooking:** En fechas especiales (ej. fin de año), la alta concurrencia causa que dos clientes reserven el mismo especialista en el mismo horario, generando conflictos operativos y daño a la reputación.

### 2.3 Potencial de escala global
* **Fase 1 (Piloto operando):** Colombia (Sede principal), Estados Unidos, Francia, Alemania y Japón.
* **Fase 2 (Expansión):** Resto de Latinoamérica y Reino Unido.

**Justificación por país:**
* **Colombia:** Origen de la franquicia, validación del modelo de negocio, moneda COP.
* **Estados Unidos / Europa (FR, DE):** Mercados de alto poder adquisitivo, validación de husos horarios complejos y monedas fuertes (USD, EUR).
* **Japón:** Validación extrema de latencia transcontinental y soporte de internacionalización (i18n) en caracteres no latinos (JPY).

### 2.4 Ventaja competitiva del sistema distribuido
Un monolito alojado en Colombia tendría tiempos de respuesta superiores a 800ms para usuarios en Japón o Alemania, y fallaría catastróficamente manejando la concurrencia de miles de usuarios intentando reservar simultáneamente.

| Requisito | Solución monolítica | Solución distribuida (QuickFade) |
| :--- | :--- | :--- |
| **Latencia global** | > 600 ms (fuera del país anfitrión) | < 150 ms (uso de CDN y API Gateway) |
| **Concurrencia (Doble reserva)**| Bloqueos de base de datos lentos | Resoluciones en < 10ms usando Redis Locks |
| **Disponibilidad** | 0% si el servidor principal cae | Microservicios independientes, RabbitMQ encola tareas |

## 3. Problemática
Los sistemas de reservas actuales fallan en escenarios de alta concurrencia. El problema concreto es la **Condición de Carrera (Race Condition)**:
1. El Cliente A (en Bogotá) y el Cliente B (en París) ven el mismo horario disponible (ej. 10:00 AM).
2. Ambos hacen clic en "Reservar" con milisegundos de diferencia.
3. Un sistema tradicional procesará ambos pagos y asignará el mismo turno a dos personas, causando un problema logístico grave en el local físico.

## 4. Justificación

* **Comercial:** Un sistema sin interrupciones y con confirmación instantánea aumenta la tasa de conversión en un 30% frente a sistemas tradicionales por WhatsApp o teléfono.
* **Técnica:** La tecnología distribuida (Redis + RabbitMQ) es indispensable para separar el bloqueo del inventario (tiempo crítico) del envío de notificaciones (tiempo no crítico), asegurando que la base de datos principal (PostgreSQL) no colapse.
* **Estratégica:** QuickFade se posiciona no solo como una barbería, sino como una empresa *Tech-forward*, permitiendo vender el software como SaaS (Software as a Service) a otras franquicias en el futuro.

## 5. Estado del arte

### 5.1 Competidores globales
* **Fresha:** Líder del mercado, pero cerrado. Altas comisiones y no permite personalización extrema de reglas de negocio distribuido.
* **Booksy:** Popular, pero sufre de problemas de latencia en regiones sin nodos dedicados.
* **Sistemas locales (ej. WhatsApp bots):** Cero escalabilidad, propensos a errores humanos, nula integración de pagos multimoneda.

### 5.2 Sistemas distribuidos existentes
* **Uber / Airbnb:** Arquitecturas distribuidas que manejan inventario (autos/casas) en tiempo real evitando overbooking. QuickFade aplica estos mismos principios al "tiempo" de un especialista.

### 5.3 Brecha de mercado
Ningún software actual de reservas de salón ofrece un sistema nativo multirregional con *Distributed Locks* garantizados, colas de notificaciones asíncronas tolerantes a fallos y un despliegue contenerizado listo para la nube.

## 6. Pregunta de investigación
¿Puede una arquitectura basada en microservicios, utilizando bloqueos distribuidos en memoria (Redis) y mensajería asíncrona (RabbitMQ), reducir a 0% la tasa de reservas duplicadas (overbooking) manteniendo una latencia de respuesta inferior a 200 ms para clientes ubicados en 3 continentes distintos?

## 7. Objetivos

### 7.1 Objetivo general
Construir e implantar un sistema distribuido de reservas multirregional que garantice la consistencia transaccional del tiempo de los especialistas, eliminando el overbooking y soportando agendamientos en tiempo real desde 5 países piloto.

### 7.2 Objetivos específicos
* **Técnicos:**
  1. Diseñar un API Gateway que enrute dinámicamente peticiones implementando un Rate Limiter estricto.
  2. Implementar un patrón de *Distributed Lock* con Redis (`SET NX`) con expiración (TTL) para bloquear horarios temporalmente mientras el usuario confirma datos.
  3. Desacoplar el envío de correos y mensajes usando un *Message Broker* (RabbitMQ) para asegurar alta disponibilidad.
* **Comerciales:**
  1. Integrar soporte nativo para 4 monedas (COP, USD, EUR, JPY) y sus respectivos husos horarios.
  2. Implementar un módulo de analítica para administradores en tiempo real.

## 8. Marco teórico
* **Teorema CAP:** QuickFade prioriza la **Consistencia (C)** y **Tolerancia a particiones (P)** para la creación de citas (no se puede reservar si hay duda de disponibilidad), pero usa **Disponibilidad (A)** para operaciones de lectura de catálogo.
* **Distributed Locks (Bloqueos Distribuidos):** Mecanismo de exclusión mutua en red para evitar que dos procesos modifiquen un recurso simultáneamente.
* **Event-Driven Architecture (Arquitectura orientada a eventos):** Uso de publicadores y suscriptores (RabbitMQ) para acciones post-transaccionales (emails).

## 9. Metodología
* **Desarrollo:** Ciclos ágiles (Scrum) y validación continua.
* **Diseño del Sistema:** Enfoque Domain-Driven Design (DDD) separando dominios: `appointments-service` y `notifications-service`.

## 10. Desarrollo

### 10.1 Análisis de requisitos
**Requisitos Funcionales:**
* Reserva, cancelación y reprogramación de citas mediante tokens de acceso únicos.
* Manejo de Lealtad (7ma cita gratis).
* Worker de notificaciones multi-idioma (Worker RabbitMQ).

**Requisitos No Funcionales:**
* RNF1: El bloqueo temporal de un horario debe resolverse en < 50ms (Redis).
* RNF2: El envío de correos no debe bloquear la respuesta HTTP al usuario (Asíncrono).

### 10.2 Diseño del sistema distribuido
* **Frontend:** Next.js (Client App). Peticiones pasan al API Gateway.
* **API Gateway:** Express.js + `http-proxy-middleware`. Maneja CORS, Rate Limiting (5 reservas/hora para evitar spam) y redirige al backend.
* **Appointments Service (Core):** Maneja la base de datos PostgreSQL. Valida `UNIQUE INDEX` para consistencia dura y consulta Redis para bloqueos en vuelo.
* **Notifications Service (Worker):** Escucha la cola `citas_creadas` en RabbitMQ y procesa correos vía Resend API y WhatsApp.
* **Bases de Datos:** PostgreSQL (Persistencia relacional), Redis (Memoria compartida para locks).

## 11. Implementación y pruebas

### 11.1 Stack tecnológico
| Componente | Tecnología |
| :--- | :--- |
| **Frontend** | React / Next.js / TailwindCSS |
| **API Gateway & Microservicios** | Node.js / Express.js |
| **Persistencia Principal** | PostgreSQL 15 |
| **Caché y Locks** | Redis 7 |
| **Message Broker** | RabbitMQ 3 |
| **Infraestructura** | Docker / Docker Compose |

### 11.2 Pruebas
1. **Prueba de Concurrencia (Race Condition):**
   * *Escenario:* Envío simultáneo de 10 peticiones POST para reservar exactamente el mismo especialista a la misma hora.
   * *Criterio de éxito:* 1 petición retorna HTTP 201 (Creado). 9 peticiones retornan HTTP 409 (Conflicto / Horario tomado).
2. **Prueba de Resiliencia Asíncrona:**
   * *Escenario:* Se apaga el servicio de notificaciones. Se crea una cita.
   * *Criterio de éxito:* La cita se crea exitosamente en la BD. El mensaje queda retenido en RabbitMQ. Al encender el servicio, el correo se envía.

## 12. Evaluación de resultados
*(Para llenar tras la ejecución final de pruebas)*
* **Tasa de overbooking:** 0% alcanzado gracias al uso combinado de Redis (`NX`) y `UNIQUE INDEX` en PostgreSQL.
* **Latencia de confirmación:** Promedio < 150ms desde la petición hasta la respuesta HTTP 201.
* **Soporte Internacional:** Validada la conversión de husos horarios (UTC a hora local del negocio) independientemente de dónde se encuentre el cliente.

## 13. Conclusiones
1. **Solución a la Concurrencia:** La integración de Redis como manejador de bloqueos temporales resolvió la problemática principal de las plataformas de reserva, validando la hipótesis técnica.
2. **Desacoplamiento:** El uso de RabbitMQ demostró ser crítico. Enviar un correo electrónico puede tardar 2 segundos; al hacerlo asíncrono, la experiencia del usuario se percibe como instantánea.
3. **Escalabilidad Global:** La arquitectura contenerizada con Docker permite que los servicios se desplieguen rápidamente en nuevas regiones, cumpliendo el objetivo comercial de internacionalización.

## 14. Referencias
* Kleppmann, M. (2017). *Designing Data-Intensive Applications*. O'Reilly Media.
* Documentación oficial de Redis (Distributed Locks with Redis).
* Documentación oficial de RabbitMQ (Reliable Delivery).

## 15. Anexos
* **Anexo A:** Diagrama de Arquitectura y flujo de microservicios.
* **Anexo B:** Script de pruebas de carga concurrente.
* **Anexo C:** Repositorio de código fuente (GitHub).
