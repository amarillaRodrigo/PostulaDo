# syntax=docker/dockerfile:1

# Imagen de produccion de la API.
#
# El proyecto compila a `dist/src/main.js` (no `dist/main.js`), y Prisma
# necesita su cliente generado y sus migraciones en la imagen: sin eso el
# contenedor arranca y falla en la primera consulta. Sin SGLang la API
# funciona igual, extrayendo las tecnologias del texto con el vocabulario
# local de 36 tecnologias.

ARG NODE_VERSION=24.14.1

################################################################################
# Build: dependencias completas + cliente Prisma + compilacion.
FROM node:${NODE_VERSION}-alpine AS build

WORKDIR /usr/src/app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json tsconfig.build.json nest-cli.json prisma.config.ts ./
COPY prisma ./prisma
RUN npx prisma generate

COPY src ./src
RUN npm run build

################################################################################
# Runtime: solo dependencias de produccion, cliente Prisma y migraciones.
FROM node:${NODE_VERSION}-alpine AS runtime

WORKDIR /usr/src/app

ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci --omit=dev \
  && npm install --no-save prisma@7.8.0 \
  && npm cache clean --force

COPY prisma.config.ts ./
COPY prisma ./prisma
RUN npx prisma generate

COPY --from=build /usr/src/app/dist ./dist
COPY scripts/start.sh ./scripts/start.sh

USER node

EXPOSE 3000

# Las migraciones corren al arrancar. Con una sola instancia alcanza; con
# varias, moverlo a un paso previo al deploy.
# `start.sh` reintenta la migracion con timeout: un cuelgue de red no deja el
# deploy 15 minutos sin abrir el puerto.
CMD ["sh", "scripts/start.sh"]
