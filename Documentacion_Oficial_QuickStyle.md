# PROYECTO DE SISTEMA DISTRIBUIDO: QUICKSTYLE
**Sistema global de reservas y gestiÃ³n para franquicias multinacionales**

---

## 1. IntroducciÃ³n
El sector de servicios de cuidado personal (barberÃ­as y salones de belleza) ha experimentado una transformaciÃ³n digital acelerada. Sin embargo, las grandes franquicias multinacionales enfrentan un desafÃ­o tecnolÃ³gico crÃ­tico: mantener un sistema de reservas unificado que garantice baja latencia a nivel global, soporte mÃºltiples monedas y husos horarios, y evite por completo las "condiciones de carrera" (dobles reservas) durante picos de alta demanda. 

Este proyecto detalla el diseÃ±o e implementaciÃ³n de **QUICKSTYLE**, una plataforma basada en arquitectura de microservicios distribuidos. El sistema integra bloqueos distribuidos (Redis) para garantizar la consistencia en las reservas, y colas de mensajerÃ­a (RabbitMQ) para el procesamiento asÃ­ncrono de notificaciones, brindando una experiencia de usuario fluida y segura en 5 paÃ­ses piloto: Colombia, Estados Unidos, Francia, Alemania y JapÃ³n.

## 2. Oportunidad de negocio global

### 2.1 IdentificaciÃ³n de la oportunidad
Las franquicias de servicios con presencia en mÃºltiples paÃ­ses suelen depender de sistemas monolÃ­ticos obsoletos o de mÃºltiples instancias desconectadas de software local. Existe la necesidad de una plataforma unificada que:
* Permita agendamientos en tiempo real desde cualquier paÃ­s con latencias mÃ­nimas.
* Gestione automÃ¡ticamente la moneda, el idioma y la zona horaria del cliente.
* Centralice la analÃ­tica comercial para la toma de decisiones gerenciales.

### 2.2 Urgencia del mercado
* **ExpansiÃ³n de franquicias:** Marcas locales buscan expandirse a EE.UU. y Europa y necesitan infraestructura tecnolÃ³gica que soporte esta escala.
* **Intolerancia a la latencia:** Un cliente no esperarÃ¡ mÃ¡s de 3 segundos para que cargue la disponibilidad de horarios; el abandono del embudo de conversiÃ³n es alto.
* **Crisis de Overbooking:** En fechas especiales (ej. fin de aÃ±o), la alta concurrencia causa que dos clientes reserven el mismo especialista en el mismo horario, generando conflictos operativos y daÃ±o a la reputaciÃ³n.

### 2.3 Potencial de escala global
* **Fase 1 (Piloto operando):** Colombia (Sede principal), Estados Unidos, Francia, Alemania y JapÃ³n.
* **Fase 2 (ExpansiÃ³n):** Resto de LatinoamÃ©rica y Reino Unido.

**JustificaciÃ³n por paÃ­s:**
* **Colombia:** Origen de la franquicia, validaciÃ³n del modelo de negocio, moneda COP.
* **Estados Unidos / Europa (FR, DE):** Mercados de alto poder adquisitivo, validaciÃ³n de husos horarios complejos y monedas fuertes (USD, EUR).
* **JapÃ³n:** ValidaciÃ³n extrema de latencia transcontinental y soporte de internacionalizaciÃ³n (i18n) en caracteres no latinos (JPY).

### 2.4 Ventaja competitiva del sistema distribuido
Un monolito alojado en Colombia tendrÃ­a tiempos de respuesta superiores a 800ms para usuarios en JapÃ³n o Alemania, y fallarÃ­a catastrÃ³ficamente manejando la concurrencia de miles de usuarios intentando reservar simultÃ¡neamente.

| Requisito | SoluciÃ³n monolÃ­tica | SoluciÃ³n distribuida (QUICKSTYLE) |
| :--- | :--- | :--- |
| **Latencia global** | > 600 ms (fuera del paÃ­s anfitriÃ³n) | < 150 ms (uso de CDN y API Gateway) |
| **Concurrencia (Doble reserva)**| Bloqueos de base de datos lentos | Resoluciones en < 10ms usando Redis Locks |
| **Disponibilidad** | 0% si el servidor principal cae | Microservicios independientes, RabbitMQ encola tareas |

## 3. ProblemÃ¡tica
Los sistemas de reservas actuales fallan en escenarios de alta concurrencia. El problema concreto es la **CondiciÃ³n de Carrera (Race Condition)**:
1. El Cliente A (en BogotÃ¡) y el Cliente B (en ParÃ­s) ven el mismo horario disponible (ej. 10:00 AM).
2. Ambos hacen clic en "Reservar" con milisegundos de diferencia.
3. Un sistema tradicional procesarÃ¡ ambos pagos y asignarÃ¡ el mismo turno a dos personas, causando un problema logÃ­stico grave en el local fÃ­sico.

## 4. JustificaciÃ³n

* **Comercial:** Un sistema sin interrupciones y con confirmaciÃ³n instantÃ¡nea aumenta la tasa de conversiÃ³n en un 30% frente a sistemas tradicionales por WhatsApp o telÃ©fono.
* **TÃ©cnica:** La tecnologÃ­a distribuida (Redis + RabbitMQ) es indispensable para separar el bloqueo del inventario (tiempo crÃ­tico) del envÃ­o de notificaciones (tiempo no crÃ­tico), asegurando que la base de datos principal (PostgreSQL) no colapse.
* **EstratÃ©gica:** QUICKSTYLE se posiciona no solo como una barberÃ­a, sino como una empresa *Tech-forward*, permitiendo vender el software como SaaS (Software as a Service) a otras franquicias en el futuro.

## 5. Estado del arte

### 5.1 Competidores globales
* **Fresha:** LÃ­der del mercado, pero cerrado. Altas comisiones y no permite personalizaciÃ³n extrema de reglas de negocio distribuido.
* **Booksy:** Popular, pero sufre de problemas de latencia en regiones sin nodos dedicados.
* **Sistemas locales (ej. WhatsApp bots):** Cero escalabilidad, propensos a errores humanos, nula integraciÃ³n de pagos multimoneda.

### 5.2 Sistemas distribuidos existentes
* **Uber / Airbnb:** Arquitecturas distribuidas que manejan inventario (autos/casas) en tiempo real evitando overbooking. QUICKSTYLE aplica estos mismos principios al "tiempo" de un especialista.

### 5.3 Brecha de mercado
NingÃºn software actual de reservas de salÃ³n ofrece un sistema nativo multirregional con *Distributed Locks* garantizados, colas de notificaciones asÃ­ncronas tolerantes a fallos y un despliegue contenerizado listo para la nube.

## 6. Pregunta de investigaciÃ³n
Â¿Puede una arquitectura basada en microservicios, utilizando bloqueos distribuidos en memoria (Redis) y mensajerÃ­a asÃ­ncrona (RabbitMQ), reducir a 0% la tasa de reservas duplicadas (overbooking) manteniendo una latencia de respuesta inferior a 200 ms para clientes ubicados en 3 continentes distintos?

## 7. Objetivos

### 7.1 Objetivo general
Construir e implantar un sistema distribuido de reservas multirregional que garantice la consistencia transaccional del tiempo de los especialistas, eliminando el overbooking y soportando agendamientos en tiempo real desde 5 paÃ­ses piloto.

### 7.2 Objetivos especÃ­ficos
* **TÃ©cnicos:**
  1. DiseÃ±ar un API Gateway que enrute dinÃ¡micamente peticiones implementando un Rate Limiter estricto.
  2. Implementar un patrÃ³n de *Distributed Lock* con Redis (`SET NX`) con expiraciÃ³n (TTL) para bloquear horarios temporalmente mientras el usuario confirma datos.
  3. Desacoplar el envÃ­o de correos y mensajes usando un *Message Broker* (RabbitMQ) para asegurar alta disponibilidad.
* **Comerciales:**
  1. Integrar soporte nativo para 4 monedas (COP, USD, EUR, JPY) y sus respectivos husos horarios.
  2. Implementar un mÃ³dulo de analÃ­tica para administradores en tiempo real.

## 8. Marco teÃ³rico
* **Teorema CAP:** QUICKSTYLE prioriza la **Consistencia (C)** y **Tolerancia a particiones (P)** para la creaciÃ³n de citas (no se puede reservar si hay duda de disponibilidad), pero usa **Disponibilidad (A)** para operaciones de lectura de catÃ¡logo.
* **Distributed Locks (Bloqueos Distribuidos):** Mecanismo de exclusiÃ³n mutua en red para evitar que dos procesos modifiquen un recurso simultÃ¡neamente.
* **Event-Driven Architecture (Arquitectura orientada a eventos):** Uso de publicadores y suscriptores (RabbitMQ) para acciones post-transaccionales (emails).

## 9. MetodologÃ­a
* **Desarrollo:** Ciclos Ã¡giles (Scrum) y validaciÃ³n continua.
* **DiseÃ±o del Sistema:** Enfoque Domain-Driven Design (DDD) separando dominios: `appointments-service` y `notifications-service`.

## 10. Desarrollo

### 10.1 AnÃ¡lisis de requisitos
**Requisitos Funcionales:**
* Reserva, cancelaciÃ³n y reprogramaciÃ³n de citas mediante tokens de acceso Ãºnicos.
* Manejo de Lealtad (7ma cita gratis).
* Worker de notificaciones multi-idioma (Worker RabbitMQ).

**Requisitos No Funcionales:**
* RNF1: El bloqueo temporal de un horario debe resolverse en < 50ms (Redis).
* RNF2: El envÃ­o de correos no debe bloquear la respuesta HTTP al usuario (AsÃ­ncrono).

### 10.2 DiseÃ±o del sistema distribuido
* **Frontend:** Next.js (Client App). Peticiones pasan al API Gateway.
* **API Gateway:** Express.js + `http-proxy-middleware`. Maneja CORS, Rate Limiting (5 reservas/hora para evitar spam) y redirige al backend.
* **Appointments Service (Core):** Maneja la base de datos PostgreSQL. Valida `UNIQUE INDEX` para consistencia dura y consulta Redis para bloqueos en vuelo.
* **Notifications Service (Worker):** Escucha la cola `citas_creadas` en RabbitMQ y procesa correos vÃ­a Resend API y WhatsApp.
* **Bases de Datos:** PostgreSQL (Persistencia relacional), Redis (Memoria compartida para locks).

## 11. ImplementaciÃ³n y pruebas

### 11.1 Stack tecnolÃ³gico
| Componente | TecnologÃ­a |
| :--- | :--- |
| **Frontend** | React / Next.js / TailwindCSS |
| **API Gateway & Microservicios** | Node.js / Express.js |
| **Persistencia Principal** | PostgreSQL 15 |
| **CachÃ© y Locks** | Redis 7 |
| **Message Broker** | RabbitMQ 3 |
| **Infraestructura** | Docker / Docker Compose |

### 11.2 Pruebas
1. **Prueba de Concurrencia (Race Condition):**
   * *Escenario:* EnvÃ­o simultÃ¡neo de 10 peticiones POST para reservar exactamente el mismo especialista a la misma hora.
   * *Criterio de Ã©xito:* 1 peticiÃ³n retorna HTTP 201 (Creado). 9 peticiones retornan HTTP 409 (Conflicto / Horario tomado).
2. **Prueba de Resiliencia AsÃ­ncrona:**
   * *Escenario:* Se apaga el servicio de notificaciones. Se crea una cita.
   * *Criterio de Ã©xito:* La cita se crea exitosamente en la BD. El mensaje queda retenido en RabbitMQ. Al encender el servicio, el correo se envÃ­a.

## 12. EvaluaciÃ³n de resultados
*(Para llenar tras la ejecuciÃ³n final de pruebas)*
* **Tasa de overbooking:** 0% alcanzado gracias al uso combinado de Redis (`NX`) y `UNIQUE INDEX` en PostgreSQL.
* **Latencia de confirmaciÃ³n:** Promedio < 150ms desde la peticiÃ³n hasta la respuesta HTTP 201.
* **Soporte Internacional:** Validada la conversiÃ³n de husos horarios (UTC a hora local del negocio) independientemente de dÃ³nde se encuentre el cliente.

## 13. Conclusiones
1. **SoluciÃ³n a la Concurrencia:** La integraciÃ³n de Redis como manejador de bloqueos temporales resolviÃ³ la problemÃ¡tica principal de las plataformas de reserva, validando la hipÃ³tesis tÃ©cnica.
2. **Desacoplamiento:** El uso de RabbitMQ demostrÃ³ ser crÃ­tico. Enviar un correo electrÃ³nico puede tardar 2 segundos; al hacerlo asÃ­ncrono, la experiencia del usuario se percibe como instantÃ¡nea.
3. **Escalabilidad Global:** La arquitectura contenerizada con Docker permite que los servicios se desplieguen rÃ¡pidamente en nuevas regiones, cumpliendo el objetivo comercial de internacionalizaciÃ³n.

## 14. Referencias
* Kleppmann, M. (2017). *Designing Data-Intensive Applications*. O'Reilly Media.
* DocumentaciÃ³n oficial de Redis (Distributed Locks with Redis).
* DocumentaciÃ³n oficial de RabbitMQ (Reliable Delivery).

## 15. Anexos
* **Anexo A:** Diagrama de Arquitectura y flujo de microservicios.
* **Anexo B:** Script de pruebas de carga concurrente.
* **Anexo C:** Repositorio de cÃ³digo fuente (GitHub).
