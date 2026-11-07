# Deploy de la API

El objetivo es que `https://rodrigoamarilla.tech/postulado/` deje de decir
"la API no está conectada" y pueda analizar un lote de ofertas de verdad.

La API **no necesita GPU**. El analisis del lote solo usa las tecnologias de
cada oferta, y esas salen del extractor local de 36 tecnologias. El modelo
(SGLang o cualquier API compatible con OpenAI) solo agrega la carta de
presentacion y el CV optimizado, que la landing no muestra.

## Que se despliega

| Pieza | Proveedor | Plan | Para que |
| --- | --- | --- | --- |
| API NestJS | Render (Docker) | free | Atiende el navegador |
| PostgreSQL | Neon | free | Usuarios, postulaciones y las migraciones |
| Redis | Redis Cloud | free 30 MB | La cola de BullMQ que analiza en segundo plano |

Los tres tienen plan gratuito sin fecha de vencimiento. Render duerme el
servicio a los ~15 minutos sin trafico: el primer request despues de eso
tarda entre 30 y 60 segundos (ver "Cold start" al final).

## 1. Postgres en Neon

1. Crear un proyecto en <https://neon.tech>.
2. En **Connection string** copiar **dos** valores:
   - la que incluye `-pooler` en el host -> `DATABASE_URL`
   - la directa (sin `-pooler`) -> `DIRECT_URL`

`DIRECT_URL` es la que usa `prisma migrate deploy` al arrancar el contenedor.
Si Neon te da una sola URL, usala en las dos variables.

## 2. Redis

Cualquiera de los dos sirve. **Redis Cloud** es preferible con BullMQ porque
soporta comandos bloqueantes sin recortes.

- Redis Cloud: <https://redis.io/cloud> -> plan free 30 MB. Copiar la URL
  `redis://default:password@host:puerto`.
- Upstash: <https://upstash.com> -> Redis -> copiar la URL `rediss://...`.

Esa unica URL va en `REDIS_URL`. La API la parsea y activa TLS sola cuando el
esquema es `rediss://`.

## 3. API en Render

1. Crear cuenta en <https://render.com> y conectar el repositorio de GitHub.
2. **New -> Blueprint** y elegir el repo. Render lee `render.yaml` y crea el
   servicio `postulado-api` con Docker y plan free.
3. Completar las variables que el blueprint deja vacias (`sync: false`):

| Variable | Valor |
| --- | --- |
| `DATABASE_URL` | La URL con `-pooler` de Neon |
| `DIRECT_URL` | La URL directa de Neon |
| `REDIS_URL` | La URL de Redis Cloud o Upstash |
| `JWT_SECRET` | Lo genera Render solo |
| `CORS_ORIGINS` | Ya viene con `https://rodrigoamarilla.tech` |

4. Deploy. El contenedor corre `prisma migrate deploy` antes de levantar
   Nest, asi que la base queda migrada en el primer arranque.

## 4. Verificar

```powershell
$API = "https://postulado-api.onrender.com"   # la URL que da Render

# responde?
Invoke-WebRequest "$API/" -UseBasicParsing | Select-Object StatusCode

# CORS del portfolio
Invoke-WebRequest "$API/auth/register" -Method OPTIONS -Headers @{
  Origin = "https://rodrigoamarilla.tech"
  "Access-Control-Request-Method" = "POST"
  "Access-Control-Request-Headers" = "content-type"
} -UseBasicParsing | ForEach-Object {
  $_.Headers["Access-Control-Allow-Origin"]
}
```

Despues, desde la landing local, un lote de 3 ofertas tiene que devolver
temas con porcentajes y alternativas.

## 5. Publicar la landing contra la API

En `web/`, compilar con la URL de la API y copiar el export al portfolio:

```powershell
cd D:\programacion\PostulaDo\web
$env:NEXT_PUBLIC_API_URL = "https://postulado-api.onrender.com"
$env:STATIC_EXPORT = "1"
$env:BASE_PATH = "/postulado"
npm run build

Remove-Item -Recurse -Force D:\programacion\portfolio\public\postulado\*
Copy-Item -Recurse -Force .\out\* D:\programacion\portfolio\public\postulado\
```

Commit y push del portfolio: Cloudflare Pages reconstruye `master` y publica
`/postulado/` con la API conectada.

> `NEXT_PUBLIC_API_URL` se graba en el bundle en tiempo de build. Si cambia la
> URL de la API hay que volver a compilar y volver a copiar el export.

## Si el deploy falla

**`TypeError: Invalid URL` con `code: 'ERR_INVALID_URL'`.** La consola de Redis
Cloud muestra el endpoint como comando (`redis-cli -u redis://default:...`).
Si se pega entero, `REDIS_URL` no es una URL. La API ya limpia ese prefijo,
pero igual conviene dejar en Render solo la URL:

```
redis://default:TU_CLAVE@megasoft-cake-tangelo-25984.db.redis.io:15509
```

Despues de corregir una variable hay que **Manual Deploy -> Deploy latest
commit**: Render no reinicia solo porque cambie una env var.

**La API arranca pero Redis no conecta** (`ECONNRESET`, `ETIMEDOUT`). El
proveedor esta exigiendo TLS: cambiar el esquema a `rediss://` con el mismo
host, puerto y credenciales.

**`P1001` / `Can't reach database server`.** `DATABASE_URL` o `DIRECT_URL`
mal copiadas, o Neon suspendido. La directa (sin `-pooler`) es la que usa
`prisma migrate deploy`; el host del pooler es otro.

## Notas de operacion

**Cold start.** Render free duerme el servicio. Si molesta, un cron gratis
(GitHub Actions cada 10 minutos) lo mantiene despierto; el costo es que el
servicio nunca duerme.

**Migraciones.** Corren al arrancar. Con una sola instancia alcanza; con
varias hay que moverlo a un paso previo al deploy.

**Sin modelo.** Si `SGLANG_URL` no responde, cada oferta se analiza con el
extractor local y el resultado lo declara (`fuente: "local"`). La carta y el
CV quedan con un texto que dice que no se generaron: nunca contenido falso.

**Limites del plan free.** Neon y Redis Cloud tienen topes de conexiones y
memoria; para una demo alcanzan de sobra. Si el trafico crece, el primer
cuello es el cold start, no la base.
