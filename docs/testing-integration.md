# Pruebas de integración en PostulaDo

## Objetivo

Este flujo valida la integración real entre la API, los servicios de Nest, Prisma y una base de datos PostgreSQL aislada.

La meta es probar el sistema completo con el menor uso posible de mocks, para confirmar que las piezas trabajan juntas como lo harían en un entorno real.

## Qué se implementó

### 1. Base de datos de test en Docker

Se creó `compose.test.yaml` para levantar una instancia temporal de PostgreSQL en Docker.

Eso sirve para:

- no usar la base de datos de desarrollo
- no tocar Supabase ni otros entornos remotos
- tener una base aislada y repetible en cada ejecución
- asegurar que los tests de integración sean predecibles

### 2. Variables de entorno de test

Se creó `.env.test` con credenciales apuntando al contenedor local.

Eso sirve para que:

- `DATABASE_URL` y `DIRECT_URL` apunten solo al Postgres de Docker
- `JWT_SECRET` y `JWT_EXPIRES_IN` usen valores de prueba
- la aplicación no lea configuración de producción ni de Supabase

### 3. Runner de integración

Se creó `scripts/run-integration-tests.mjs` para automatizar el flujo completo.

Ese runner hace, en orden:

1. cargar `.env.test`
2. levantar el contenedor de PostgreSQL
3. esperar a que la base responda
4. aplicar migraciones con Prisma
5. ejecutar `npm run test:e2e`
6. apagar y eliminar el contenedor al final

Eso sirve para que una sola orden ejecute toda la infraestructura necesaria y deje el entorno limpio al terminar.

### 4. Script de npm

Se agregó `test:integration` en `package.json`.

Eso permite correr todo con un comando simple:

```bash
npm run test:integration
```

### 5. Pruebas e2e reales

Se creó `test/auth.e2e-spec.ts` para validar autenticación y acceso a usuarios con HTTP real.

Ese archivo prueba:

- registro de usuario
- login con JWT
- acceso al propio usuario con ownership
- denegación de acceso a otro usuario
- acceso de admin a listado de usuarios
- eliminación de usuarios como admin
- rechazo de credenciales incorrectas

## Por qué se hizo así

Se eligió este enfoque para evaluar la integración entre la API, los servicios y la base de datos con el menor uso posible de mocks.

Esto da más confianza que un test aislado porque valida el flujo completo:

- Nest arranca con el módulo real
- Prisma se conecta a PostgreSQL real
- las migraciones se aplican sobre una base real
- los endpoints se consumen por HTTP real
- JWT, guards e interceptores participan en la misma ejecución

## Qué hace cada etapa

### Levantar Docker

Docker crea la base temporal de pruebas.

Sirve para aislar la ejecución y evitar depender de servicios externos.

### Aplicar migraciones

Prisma prepara el esquema de la base con `migrate deploy`.

Sirve para garantizar que la estructura de datos exista antes de ejecutar los tests.

### Arrancar Nest

La app se inicia con `AppModule` real.

Sirve para probar la aplicación completa, no solo funciones sueltas.

### Ejecutar requests HTTP

Supertest llama a los endpoints reales.

Sirve para validar contratos, validaciones, guards y respuestas.

### Limpiar datos

Antes de cada prueba se eliminan los registros creados.

Sirve para evitar contaminación entre casos y mantener resultados deterministas.

### Apagar el contenedor

Al final, el runner baja el contenedor y elimina el volumen.

Sirve para dejar el entorno limpio y evitar basura de infraestructura.

## Cómo se ejecuta

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
- las migraciones son compatibles con el código
- el registro y login funcionan
- los guards de ownership y roles funcionan
- la integración entre capas está estable

## Siguientes pasos sugeridos

- agregar pruebas de actualización de usuario
- agregar pruebas de eliminación con permisos
- agregar pruebas de postulaciones
- sumar CI en GitHub Actions para ejecutar esta suite automáticamente