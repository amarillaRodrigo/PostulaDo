# PostulaDo

Del lote de ofertas al plan de estudio. El backend combina autenticación JWT, control de acceso por roles, ownership guards y Prisma como capa de persistencia, y un flujo de análisis con IA que captura los requisitos de una URL antes de guardarla.

El producto responde una pregunta: **de qué tengo que aprender primero**. El usuario pega un lote de ofertas, la API las agrupa por el tipo de trabajo que comparten, extrae los oficios que las cubren con su cobertura real sobre ese lote, y devuelve las alternativas de cada uno para no atar a nadie a un vendor.

## Resumen de la API

La aplicación expone actualmente estas capacidades:

- Registro e inicio de sesion con JWT.
- Gestion de usuarios con proteccion por autenticacion, rol administrador y validacion de ownership.
- **Análisis por lote:** `GET /postulaciones/analisis-lote?ids=…` agrega **solo** las postulaciones indicadas, de modo que el denominador de cada porcentaje es el lote que el usuario pegó y no su historial entero.
- **Taxonomía del oficio:** 36 tecnologías mapeadas a 8 oficios —pruebas, integración y entrega, nube, contenedores, datos, caché, backend, frontend— y por cada oficio, las alternativas que lo cubren.
- **Análisis Inteligente y Estructurado (IA):** Análisis de ofertas mediante **SGLang (XGrammar + RadixAttention)** para extraer de forma estructurada tecnologías, responsabilidades, años de experiencia y tono empresarial, y generar en paralelo informes personalizados (análisis de enfoque, cover letter y CV optimizado).
- Creacion, consulta y actualizacion de postulaciones del usuario autenticado.
- Eliminacion de contraseñas en respuestas publicas mediante interceptor global.

## Stack

- NestJS
- Next.js 16 (frontend estático)
- TypeScript
- Prisma
- PostgreSQL
- Redis (Caché y Colas)
- BullMQ (Procesamiento de colas de fondo asíncronas)
- SGLang (Inferencia de LLMs)
- OpenAI SDK & Cheerio (Scraping de texto plano)
- JWT con Passport
- class-validator y class-transformer

## Estructura del proyecto

```text
PostulaDo/
	README.md
	PRODUCT.md          contexto del producto (qué es, para quién, qué promete)
	DESIGN.md           sistema visual del frontend
	docs/design/        referencia de la landing
	.impeccable/        design system, surface brief y configuración
	src/                API NestJS
		prisma/
		common/            taxonomía del oficio
		postulaciones/     postulaciones, análisis y lote
		usuarios/
		auth/
	web/                landing Next.js (export estático)
	package.json
```

## El frontend

`web/` es una app **Next.js 16** que exporta a HTML plano: la landing vive en
`rodrigoamarilla.tech/postulado/`, publicada dentro del portfolio. No necesita
servidor propio.

El formulario habla directo con la API por CORS, asi que el análisis es asíncrono
de verdad: encola, espera el trabajo, guarda cada oferta y pide el análisis del
lote. Sin `NEXT_PUBLIC_API_URL` configurado, el formulario lo dice en vez de
fingir que funciona.

```bash
cd web
npm install
npm run dev                       # :3001, contra la API en :3000

STATIC_EXPORT=1 BASE_PATH=/postulado npm run build   # genera out/
```

## Requisitos

- Node.js 20 o superior.
- npm.
- Una base de datos PostgreSQL accesible desde `DATABASE_URL`.
- Un servidor Redis accesible para el sistema de colas (incluido en `compose.yaml`).

## Variables de entorno

Crear un archivo `.env` dentro de `postulado/` con, al menos, estas variables:

```bash
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DB"
JWT_SECRET="una_clave_segura"
JWT_EXPIRES_IN="15m"
PORT=3000

# SGLang Inferencia
SGLANG_URL="http://localhost:30000/v1"
SGLANG_API_KEY="EMPTY"

# Redis Config (BullMQ)
REDIS_HOST="localhost"
REDIS_PORT=6379
```

## Instalacion

```bash
cd postulado
npm install
npx prisma generate
```

Si necesitas aplicar las migraciones en una base de datos nueva:

```bash
npx prisma migrate dev
```

## Ejecucion

```bash
npm run start:dev
```

La API queda disponible por defecto en `http://localhost:3000`.

## Scripts disponibles

Desde `postulado/`:

```bash
npm run start
npm run start:dev
npm run build
npm run lint
npm run test
npm run test:e2e
npm run test:cov
npm run test:integration
```

`npm run test:integration` levanta una instancia de PostgreSQL en Docker, aplica migraciones Prisma y ejecuta la suite e2e completa de forma aislada.

## Autenticacion

La API usa JWT de vida corta (`15m`) mas un refresh token de 30 dias que rota
en cada uso. El flujo habitual es:

1. Registrar un usuario con `POST /auth/register` (o entrar con `POST /auth/login`).
2. Guardar el `access_token` y el `refresh_token` que devuelve la respuesta.
3. Usar el `access_token` en el header `Authorization: Bearer <token>`.
4. Cuando el access token vence, pedir un par nuevo con `POST /auth/refresh`.
5. Al cerrar sesion, revocar el refresh token con `POST /auth/logout`.

El refresh token se guarda hasheado (SHA-256) en la tabla `RefreshToken`, junto
a un `familyId`: si un token ya rotado reaparece fuera de la ventana de gracia
de 30 segundos, se revoca toda la familia. `POST /auth/reset-password` revoca
todas las sesiones de la cuenta.

Los endpoints protegidos rechazan solicitudes sin token valido.

### Registro

`POST /auth/register`

Body:

```json
{
	"email": "test@example.com",
	"password": "Password123",
	"birthDate": "1990-01-01"
}
```

### Login

`POST /auth/login`

Body:

```json
{
	"email": "test@example.com",
	"password": "Password123"
}
```

Respuesta esperada:

```json
{
	"access_token": "...",
	"refresh_token": "...",
	"expires_in": 900,
	"user": {
		"id": "...",
		"email": "..."
	}
}
```

### Renovar la sesion

`POST /auth/refresh`

Body:

```json
{ "refresh_token": "..." }
```

Devuelve un `access_token`, un `refresh_token` nuevo y `expires_in`. El token
enviado queda revocado.

### Cerrar sesion

`POST /auth/logout`

Body:

```json
{ "refresh_token": "..." }
```

Revoca el token al instante. Es idempotente: sin token (o con uno ya revocado)
responde lo mismo, para no revelar si existia.

### Cerrar sesion en todos los dispositivos

`POST /auth/logout-todos` (requiere `Authorization: Bearer <access_token>`)

Revoca todos los refresh tokens de la cuenta, incluido el del dispositivo que
hace la llamada. Devuelve `{ "cerradas": 2 }`. Los access tokens siguen
valiendo hasta que vencen (15 minutos), pero ya no se pueden renovar.

## Endpoints principales

### Usuarios

`POST /usuarios`

- Crea un usuario.
- Requiere `email`, `password` y `birthDate`.

`GET /usuarios`

- Lista usuarios paginados.
- Requiere JWT y rol `ADMIN`.

`GET /usuarios/:id`

- Devuelve un usuario por id.
- Requiere JWT y ownership.

`PUT /usuarios/:id`

- Actualiza un usuario.
- Requiere JWT y ownership.

`DELETE /usuarios/:id`

- Elimina un usuario.
- Requiere JWT y rol `ADMIN`.

### Postulaciones

#### `GET /postulaciones/analisis-lote?ids=<id,id,...>`

Analiza un lote concreto. El denominador de cada cobertura son las
postulaciones indicadas, no el historial del usuario. Devuelve el tipo de
trabajo detectado, los oficios que cubren con su porcentaje sobre el lote, las
alternativas de cada uno y una sugerencia de por dónde empezar.

`POST /postulaciones/analizar`

- Recibe una URL de oferta.
- Encola de forma asíncrona un trabajo en la cola de Redis y retorna inmediatamente un `jobId` junto con el estado `queued`.
- Requiere JWT.

`GET /postulaciones/analizar/status/:jobId`

- Consulta el estado de un trabajo de análisis por su `jobId`.
- Devuelve el estado actual (`waiting`, `active`, `completed`, `failed`).
- Si el estado es `completed`, incluye en el campo `result` la información estructurada por XGrammar generada por SGLang (tecnologías, responsabilidades, años de experiencia, tono cultural) y el informe personalizado (análisis de enfoque, cover letter y CV optimizado) utilizando RadixAttention.
- Requiere JWT y validación de propiedad (ownership) del trabajo.

`POST /postulaciones`

- Crea una postulacion para el usuario autenticado.
- Requiere JWT.

`GET /postulaciones`

- Lista las postulaciones del usuario autenticado.
- Soporta filtros por query.
- Requiere JWT.

`GET /postulaciones/:id`

- Devuelve una postulacion del usuario autenticado.
- Requiere JWT.

`PUT /postulaciones/:id`

- Actualiza una postulacion del usuario autenticado.
- Requiere JWT.

## Modelo de datos principal

### Usuario

- `id`
- `email`
- `name`
- `password`
- `role`
- `birthDate`
- `countryCode`
- `profileText` (CV o perfil del usuario para análisis de IA)
- `createdAt`
- `updatedAt`

### Postulacion

- `id`
- `userId`
- `url`
- `title`
- `description`
- `company`
- `status`
- `rawRequirements`
- `tecnologias` (Extraídas estructuradamente)
- `aniosExperiencia` (Años de experiencia requeridos)
- `responsabilidades` (Lista de responsabilidades clave)
- `tonoEmpresa` (Tono de la cultura de la empresa)
- `isArchived`
- `appliedAt`
- `createdAt`
- `updatedAt`

## Flujo de postulaciones

El flujo implementado en la API es el siguiente:

1. El usuario pega la URL de la oferta.
2. `POST /postulaciones/analizar` encola el trabajo y responde con un `jobId`.
3. El frontend realiza sondeo (*polling*) haciendo peticiones periódicas a `GET /postulaciones/analizar/status/:jobId` hasta que el estatus sea `completed`.
4. El frontend muestra el resultado estructurado de la inferencia y los reportes al usuario.
5. Si confirma la postulación, `POST /postulaciones` la persiste en base de datos.
6. Luego puede consultar o actualizar su listado desde los endpoints protegidos.

## Notas tecnicas

- Prisma se inicializa con `DATABASE_URL`.
- La configuracion JWT usa `JWT_SECRET` y `JWT_EXPIRES_IN`.
- La aplicacion valida y transforma DTOs de forma global.
- Las respuestas publicas excluyen la contraseña.

## Estado actual

La API ya cubre autenticacion, gestion de usuarios y el flujo base de postulaciones con analisis de URL, creacion y consulta por usuario autenticado.

## Documentación de integración

El detalle del flujo de pruebas de integración, la base de datos de test, Prisma y el runner automatizado está en [docs/testing-integration.md](docs/testing-integration.md).

## Pruebas de integración

La API incluye una suite e2e completa que valida la integración real entre Nest, Prisma, PostgreSQL y Redis sin mocks.

Ejecución local:

```bash
npm run test:integration
```

Este comando:
1. Levanta los contenedores de PostgreSQL y Redis en Docker Compose.
2. Aplica migraciones Prisma en la base de datos de test temporal.
3. Genera el cliente Prisma.
4. Ejecuta todos los tests e2e en modo secuencial.
5. Limpia la infraestructura al terminar.

Los tests cubren autenticación, usuarios y postulaciones con casos de permisos y validaciones.

## CI/CD

GitHub Actions ejecuta el workflow de integración en cada `push` y `pull_request` hacia `main`. El workflow corre el mismo comando `npm run test:integration` para garantizar que los cambios no rompan la integración.

El PR solo se puede mergear si el workflow pasa de forma completa.
