# Pruebas de integraci\u00f3n en PostulaDo

## Objetivo

Este flujo valida la integraci\u00f3n real entre la API, los servicios de Nest, Prisma y una base de datos PostgreSQL aislada.

La meta es probar el sistema completo con el menor uso posible de mocks, para confirmar que las piezas trabajan juntas como lo har\u00edan en un entorno real.

## Qu\u00e9 se implement\u00f3

### 1. Base de datos de test en Docker

Se cre\u00f3 `compose.test.yaml` para levantar una instancia temporal de PostgreSQL en Docker.

Eso sirve para:

- no usar la base de datos de desarrollo
- no tocar Supabase ni otros entornos remotos
- tener una base aislada y repetible en cada ejecuci\u00f3n
- asegurar que los tests de integraci\u00f3n sean predecibles

### 2. Variables de entorno de test

Se cre\u00f3 `.env.test` con credenciales apuntando al contenedor local.

Eso sirve para que:

- `DATABASE_URL` y `DIRECT_URL` apunten solo al Postgres de Docker
- `JWT_SECRET` y `JWT_EXPIRES_IN` usen valores de prueba
- la aplicaci\u00f3n no lea configuraci\u00f3n de producci\u00f3n ni de Supabase

### 3. Runner de integraci\u00f3n

Se cre\u00f3 `scripts/run-integration-tests.mjs` para automatizar el flujo completo.

Ese runner hace, en orden:

1. cargar `.env.test`
2. levantar el contenedor de PostgreSQL
3. esperar a que la base responda
4. aplicar migraciones con Prisma
5. ejecutar `npm run test:e2e`
6. apagar y eliminar el contenedor al final

Eso sirve para que una sola orden ejecute toda la infraestructura necesaria y deje el entorno limpio al terminar.

### 4. Script de npm

Se agreg\u00f3 `test:integration` en `package.json`.

Eso permite correr todo con un comando simple:

```bash
npm run test:integration
```

### 5. Pruebas e2e reales

Se cre\u00f3 `test/auth.e2e-spec.ts` para validar autenticaci\u00f3n y acceso a usuarios con HTTP real.

Ese archivo prueba:

- registro de usuario
- login con JWT
- acceso al propio usuario con ownership
- denegaci\u00f3n de acceso a otro usuario
- acceso de admin a listado de usuarios
- eliminaci\u00f3n de usuarios como admin
- rechazo de credenciales incorrectas

## Por qu\u00e9 se hizo as\u00ed

Se eligi\u00f3 este enfoque para evaluar la integraci\u00f3n entre la API, los servicios y la base de datos con el menor uso posible de mocks.

Esto da m\u00e1s confianza que un test aislado porque valida el flujo completo:

- Nest arranca con el m\u00f3dulo real
- Prisma se conecta a PostgreSQL real
- las migraciones se aplican sobre una base real
- los endpoints se consumen por HTTP real
- JWT, guards e interceptores participan en la misma ejecuci\u00f3n

## Qu\u00e9 hace cada etapa

### Levantar Docker

Docker crea la base temporal de pruebas.

Sirve para aislar la ejecuci\u00f3n y evitar depender de servicios externos.

### Aplicar migraciones

Prisma prepara el esquema de la base con `migrate deploy`.

Sirve para garantizar que la estructura de datos exista antes de ejecutar los tests.

### Arrancar Nest

La app se inicia con `AppModule` real.

Sirve para probar la aplicaci\u00f3n completa, no solo funciones sueltas.

### Ejecutar requests HTTP

Supertest llama a los endpoints reales.

Sirve para validar contratos, validaciones, guards y respuestas.

### Limpiar datos

Antes de cada prueba se eliminan los registros creados.

Sirve para evitar contaminaci\u00f3n entre casos y mantener resultados deterministas.

### Apagar el contenedor

Al final, el runner baja el contenedor y elimina el volumen.

Sirve para dejar el entorno limpio y evitar basura de infraestructura.

## C\u00f3mo se ejecuta

Desde la carpeta `postulado`:

```powershell
npm run test:integration
```

Ese comando ejecuta todo el flujo:

- levanta PostgreSQL
- aplica migraciones
- corre la suite e2e
- limpia el entorno al finalizar

## Resultado esperado

Cuando esta suite pasa, significa que:

- la API arranca correctamente
- Prisma conecta bien con la base de test
- las migraciones son compatibles con el c\u00f3digo
- el registro y login funcionan
- los guards de ownership y roles funcionan
- la integraci\u00f3n entre capas est\u00e1 estable

## Siguientes pasos sugeridos

- agregar pruebas de actualizaci\u00f3n de usuario
- agregar pruebas de eliminaci\u00f3n con permisos
- agregar pruebas de postulaciones
- sumar CI en GitHub Actions para ejecutar esta suite autom\u00e1ticamente