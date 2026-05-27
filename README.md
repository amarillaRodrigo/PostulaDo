# PostulaDo

Backend NestJS para gestionar usuarios y postulaciones laborales. La API combina autenticación JWT, control de acceso por roles, ownership guards, Prisma como capa de persistencia y un flujo de análisis de ofertas para capturar datos desde una URL antes de guardar una postulacion.

## Resumen de la API

La aplicación expone actualmente estas capacidades:

- Registro e inicio de sesion con JWT.
- Gestion de usuarios con proteccion por autenticacion, rol administrador y validacion de ownership.
- Analisis de una URL de oferta para obtener un preview antes de crear la postulacion.
- Creacion, consulta y actualizacion de postulaciones del usuario autenticado.
- Eliminacion de contraseñas en respuestas publicas mediante interceptor global.

## Stack

- NestJS
- TypeScript
- Prisma
- PostgreSQL
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
```

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
- Devuelve un preview con datos extraidos para que el frontend confirme antes de guardar.
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
