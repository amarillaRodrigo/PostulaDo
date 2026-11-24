-- El listado de postulaciones filtra por `userId` y ordena por `createdAt`.
--
-- `Postulacion` era la única tabla del schema sin ningún índice: cada
-- `GET /postulaciones` era un seq scan + sort sobre toda la tabla, y el
-- `count` del `X-Total-Count` era otro scan más.
--
-- El índice compuesto ascendente también sirve para el `DESC` del `orderBy`:
-- Postgres recorre el índice al revés.
CREATE INDEX "Postulacion_userId_createdAt_idx" ON "Postulacion"("userId", "createdAt");
