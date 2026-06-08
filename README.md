# PostulaDo

Backend NestJS para gestionar usuarios y postulaciones laborales. La API combina autenticación JWT, control de acceso por roles, ownership guards, Prisma como capa de persistencia y un flujo de análisis de ofertas para capturar datos desde una URL antes de guardar una postulacion.

## Resumen de la API

La aplicación expone actualmente estas capacidades:

- Registro e inicio de sesion con JWT.
- Gestion de usuarios con proteccion por autenticacion, rol administrador y validacion de ownership.
- **Análisis Inteligente y Estructurado (IA):** Análisis de ofertas mediante **SGLang (XGrammar + RadixAttention)** para extraer de forma estructurada tecnologías, responsabilidades, años de experiencia y tono empresarial, y generar en paralelo informes personalizados (análisis de enfoque, cover letter y CV optimizado).
- Creacion, consulta y actualizacion de postulaciones del usuario autenticado.
- Eliminacion de contraseñas en respuestas publicas mediante interceptor global.

## Stack

- NestJS
- TypeScript
- Prisma
- PostgreSQL
- SGLang (Inferencia de LLMs)
- OpenAI SDK & Cheerio (Scraping de texto plano)
- JWT con Passport
- class-validator y class-transformer

## Estructura del proyecto

El codigo de la API vive en `postulado/`.

```text
PostulaDo/
	README.md
	docs/
	postulado/
		src/
		prisma/
		package.json
```

## Requisitos

- Node.js 20 o superior.
- npm.
- Una base de datos PostgreSQL accesible desde `DATABASE_URL`.

## Variables de entorno

Crear un archivo `.env` dentro de `postulado/` con, al menos, estas variables:

```bash
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DB"
JWT_SECRET="una_clave_segura"
JWT_EXPIRES_IN="60m"
PORT=3000

# SGLang Inferencia
SGLANG_URL="http://localhost:30000/v1"
SGLANG_API_KEY="EMPTY"
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

La API usa JWT. El flujo habitual es:

1. Registrar un usuario con `POST /auth/register`.
2. Iniciar sesion con `POST /auth/login`.
3. Usar el `access_token` en el header `Authorization: Bearer <token>`.

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
	"user": {
		"id": "...",
		"email": "..."
	}
}
```

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

`POST /postulaciones/analizar`

- Recibe una URL de oferta.
- Devuelve la información extraída por SGLang estructurada por XGrammar (tecnologías, responsabilidades, años de experiencia, tono cultural) junto con el informe personalizado para el usuario (análisis, cover letter y CV optimizado) utilizando RadixAttention.
- Requiere JWT.

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
2. `POST /postulaciones/analizar` obtiene un preview de la oferta.
3. El frontend muestra el resultado al usuario.
4. Si confirma, `POST /postulaciones` persiste la postulacion.
5. Luego puede consultar o actualizar su listado desde los endpoints protegidos.

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

La API incluye una suite e2e completa que valida la integración real entre Nest, Prisma y PostgreSQL sin mocks.

Ejecución local:

```bash
npm run test:integration
```

Este comando:
1. Levanta un contenedor PostgreSQL con Docker Compose.
2. Aplica migraciones Prisma.
3. Genera el cliente Prisma.
4. Ejecuta todos los tests e2e en modo secuencial.
5. Limpia la infraestructura al terminar.

Los tests cubren autenticación, usuarios y postulaciones con casos de permisos y validaciones.

## CI/CD

GitHub Actions ejecuta el workflow de integración en cada `push` y `pull_request` hacia `main`. El workflow corre el mismo comando `npm run test:integration` para garantizar que los cambios no rompan la integración.

El PR solo se puede mergear si el workflow pasa de forma completa.
