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
# Generar una clave aleatoria: node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
JWT_SECRET="reemplazar-por-una-clave-aleatoria-de-48-bytes-o-mas"
JWT_EXPIRES_IN="15m"
PORT=3000

# SGLang Inferencia
SGLANG_URL="http://localhost:30000/v1"
SGLANG_API_KEY="EMPTY"

# Redis Config (BullMQ)
REDIS_HOST="localhost"
REDIS_PORT=6379
```

`JWT_SECRET` es obligatorio y debe tener al menos 32 bytes. La API se niega a
iniciar si falta o es demasiado corto; no hay una clave de fallback en el código.

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
a un `familyId`. La rotación es atómica: si dos requests usan el mismo token,
solo una crea el siguiente par; la otra recibe `401`. El access token incluye esa
familia y deja de servir en cuanto se cierra la sesión. `POST /auth/logout` y
`POST /auth/reset-password` invalidan también los access tokens afectados.

El análisis de prueba no requiere cuenta y no guarda datos. Para persistir ofertas
y roadmaps hace falta registrarse y confirmar el correo.

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
- Encola de forma asíncrona un trabajo en la cola de Redis y responde **`202 Accepted`** con un `jobId` y el estado `queued`.
- JWT opcional: sin sesión usa un perfil genérico y solo arma un preview.
- Para guardar las ofertas y el roadmap hace falta registrarse y confirmar el correo.

**Contrato de la respuesta `202`:**

| Qué                | Dónde  | Para qué                                                                                          |
| ------------------ | ------ | ------------------------------------------------------------------------------------------------- |
| `jobId`            | body   | Identificador del trabajo. Es un UUID.                                                            |
| `profileText`      | body   | El perfil con el que se va a analizar. Si el usuario no tiene, es el perfil genérico por defecto. |
| `perfilPorDefecto` | body   | `true` si se usó ese perfil genérico: el análisis se hizo sin el perfil real del usuario.         |
| `pollAfterMs`      | body   | Milisegundos a esperar entre consultas de estado.                                                 |
| `Location`         | header | `/postulaciones/analizar/status/:jobId`. Dónde consultar el resultado.                            |

El `profileText` y el `perfilPorDefecto` viajan en la respuesta a propósito: el
resultado depende del perfil del usuario, que no viene en el request. Sin
ellos, dos personas con el mismo body reciben análisis distintos y ninguna
puede explicar por qué.

**Por qué el intervalo no es un `Retry-After`:** `Retry-After` significa
"reintentá **esta** request". En el 202 no hay nada que reintentar: el
trabajo ya está encolado y hay que ir a buscar el resultado a otra URL. Un
cliente con lógica genérica ("si viene `Retry-After`, espero y reintento lo
mismo") reencolaría el análisis cada dos segundos y duplicaría jobs. Por eso
el intervalo viaja en el body (`pollAfterMs`) y el `Retry-After` queda
reservado para el 503, que es donde de verdad significa "reintentá".

**Errores de este endpoint:**

- `401` — se envió un JWT inválido o vencido. Sin JWT, el preview sigue disponible.
- `422` — la URL no es una URL.
- `503` — la cola está llena (Redis cerca del tope de memoria del plan). Es
  transitorio: reintentá con backoff. Trae `Retry-After` con cada cuántos
  segundos. El plazo es un valor elegido, no una medición: `asegurarEspacio()`
  no sabe cuándo va a haber lugar, sabe que hay que limpiar antes de volver
  a medir.

`GET /postulaciones/analizar/status/:jobId`

- Consulta el estado de un trabajo de análisis por su `jobId`.
- Devuelve el estado actual (`waiting`, `active`, `completed`, `failed`).
- Si el estado es `completed`, incluye en el campo `result` la información estructurada por XGrammar generada por SGLang (tecnologías, responsabilidades, años de experiencia, tono cultural) y el informe personalizado (análisis de enfoque, cover letter y CV optimizado) utilizando RadixAttention.
- JWT opcional: los trabajos autenticados solo los consulta su dueño; para un preview anónimo, el `jobId` es la credencial de consulta.

**Errores de este endpoint:**

- `401` — se envió un JWT inválido o vencido.
- `403` — el trabajo existe (o existió) pero es de otro usuario. Su `result`
  incluye el CV optimizado y la carta de presentación de esa persona, así que
  no se entrega a nadie más.
- `404` — ese `jobId` nunca existió.
- `410` — el trabajo era tuyo pero expiró. Los resultados se purgan de la cola a
  las 24 h de terminar, o antes si se supera el tope de 200 trabajos
  completados. Hay que encolar el análisis de nuevo.

La ventana de consulta es finita y por eso `404` y `410` son cosas distintas:
`404` es un `jobId` que el cliente se inventó, `410` es un trabajo que existió
y se fue. La API lo distingue con una marca en Redis que sobrevive 7 días al
trabajo, que dura 24.

#### Identificadores opacos

Los `jobId` son UUID, no los enteros correlativos que pone BullMQ por
defecto. La diferencia no es estética: con un `INCR`, un `GET
.../status/1`, `/2`, `/3` recorre la cola entera, y un `403` confirmaría que
ese trabajo existe. Un identificador opaco es un requisito de seguridad: sin
él, "no autorizado" y "existe" son la misma respuesta y no se pueden
separar.

Es el mismo patrón que aplica a los endpoints con UUID en la URL
(`/postulaciones/:id`, `/lotes/:id`): ahí el `403` es seguro justamente
porque el id no se adivina.

#### La marca de vigencia tiene tope

La marca ("este trabajo existió") vive en **una sola clave** de Redis, un
hash con un campo por trabajo, y tiene dos límites: 7 días de vigencia y un
tope de 2000 entradas. Cuando se supera el tope se borran las marcas más
viejas, y esos trabajos pasan a dar `404` en vez de `410`.

Sin ese tope, la marca sería la única estructura del proyecto que crece sin
límite: la cola tiene tope por edad y por cantidad, y Redis está en un plan
de 30 MB. El recorte corre en el mismo barrido de 30 minutos que ya limpia
los trabajos terminados.

`POST /postulaciones`

- Crea una postulacion para el usuario autenticado.
- Requiere JWT.

`GET /postulaciones`

- Lista las postulaciones del usuario autenticado.
- Soporta filtros por query: `status`, `isArchived`, `page`, `limit` y `cursor`.
- Requiere JWT.

**Paginación:**

| Qué             | Dónde  | Para qué                                                                  |
| --------------- | ------ | ------------------------------------------------------------------------- |
| `X-Total-Count` | header | Total de postulaciones que matchean el filtro, **no** las de esta página. |
| `X-Next-Cursor` | header | Cursor de la página siguiente. Solo viene si hay más.                     |
| `Cache-Control` | header | `private, no-store`. La lista es de una sesión y caduca con ella.         |

El body sigue siendo un array pelado: el total y el cursor van en los headers
para no romper a los que ya consumen esta respuesta.

**Dos formas de paginar, que conviven:**

- `?page=2&limit=50` — desplazamiento clásico. Simple, pero **deriva**: si
  entre la página 1 y la 2 se inserta una postulación, todos los offsets se
  corren un lugar y un registro se duplica o se salta.
- `?cursor=<X-Next-Cursor>&limit=50` — la posición exacta de la última fila de
  la página anterior. No deriva. Cuando viene `cursor`, `page` se ignora.

El cursor es opaco: el servidor lo manda en `X-Next-Cursor` y el cliente lo
devuelve tal cual. Un cursor mal formado es `422`.

- `page` empieza en 1.
- `limit` va de 1 a **100**. Pedir más es `422`: el pedido se entiende pero no
  cumple las reglas. Sin este tope, `?limit=100000` hacía que la base
  devolviera cien mil filas en una request.

El listado devuelve solo los campos que la UI necesita (id, url, title,
company, status, tecnologias, aniosExperiencia, isArchived, createdAt y
userId). El texto íntegro de la oferta (`description`) y el JSON de requisitos
(`rawRequirements`) están en `GET /postulaciones/:id`: en un listado son
miles de caracteres por fila que nadie mira.

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
2. `POST /postulaciones/analizar` encola el trabajo y responde `202` con un `jobId`, el `Location` de dónde consultar y el `pollAfterMs` con el intervalo de sondeo.
3. El frontend realiza sondeo (_polling_) haciendo peticiones periódicas a `GET /postulaciones/analizar/status/:jobId` hasta que el estatus sea `completed`. El intervalo lo fija el servidor en el `pollAfterMs`.
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
