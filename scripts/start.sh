#!/bin/sh
set -eu

# Arranque del contenedor.
#
# `prisma migrate deploy` es idempotente, asi que reintentarlo es seguro. En
# Render free el primer intento puede quedarse esperando a que Neon despierte
# (o a que se libere una conexion). Sin limite, el deploy se cuelga hasta el
# timeout de 15 minutos de Render sin decir nada, y hay que redeployar a mano.
#
# Con 3 intentos de 90 s: un bache de red se resuelve solo, y un problema real
# falla en menos de 5 minutos con el motivo en el log.

intentos=3
limite=90
espera=5

i=1
while [ "$i" -le "$intentos" ]; do
  echo "[start] migraciones: intento $i de $intentos"

  if timeout -s TERM -k 10 "$limite" npx prisma migrate deploy; then
    echo "[start] migraciones al dia; arrancando la API"
    exec node dist/src/main.js
  fi

  echo "[start] el intento $i fallo o supero ${limite}s"
  i=$((i + 1))

  if [ "$i" -le "$intentos" ]; then
    echo "[start] reintento en ${espera}s"
    sleep "$espera"
  fi
done

echo "[start] no se pudieron aplicar las migraciones; se aborta el arranque"
exit 1
