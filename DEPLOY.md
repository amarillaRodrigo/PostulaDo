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
| `RESEND_API_KEY` | La clave de Resend, para mandar el mail de confirmacion |

4. Deploy. El contenedor corre `prisma migrate deploy` antes de levantar
   Nest, asi que la base queda migrada en el primer arranque.

## 3.1 Correo de confirmacion (Resend)

La cuenta se crea igual sin esto: la API no manda el mail, lo deja en el log y
la landing avisa que no pudo enviarlo. Para que llegue de verdad:

1. Crear cuenta gratis en <https://resend.com> (3.000 mails/mes, 100/dia).
2. **Domains -> Add domain** con `rodrigoamarilla.tech`. Resend da tres
   registros DNS (SPF, DKIM y, opcional, DMARC). Cargarlos en Cloudflare tal
   cual los muestra; **no** los proxies (nube gris, no naranja).
3. Esperar la verificacion del dominio (minutos, a veces una hora).
4. **API Keys -> Create**, permiso *Sending access*, y copiar la clave.
5. En Render: **Environment -> Add Environment Variable**
   `RESEND_API_KEY = re_...` y despues **Manual Deploy -> Deploy latest commit**
   (cambiar una variable no reinicia el servicio).

Variables que ya trae `render.yaml`:

| Variable | Valor |
| --- | --- |
| `APP_PUBLIC_URL` | `https://rodrigoamarilla.tech/postulado` (arma el enlace) |
| `MAIL_FROM` | `PostulaDo <no-reply@rodrigoamarilla.tech>` |
| `RESEND_API_KEY` | `sync: false`, se carga a mano |

Sin dominio verificado, Resend rechaza el envio con `403` y la API lo registra
como `Resend rechazo el envio`. La cuenta sigue funcionando; solo falta el
mail.

El mismo remitente cubre el flujo de **olvide mi contrasena**
(`POST /auth/olvide-password` y `POST /auth/reset-password`). El enlace de
recuperacion vence en 1 hora, se guarda solo su hash y sirve una sola vez. La
respuesta de `olvide-password` es siempre la misma exista o no la cuenta, para
no revelar que correos estan registrados; si no hay proveedor, la landing lo
dice en vez de fingir que lo mando.

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

## Memoria de Redis (plan free)

El plan free de Redis Cloud son **30 MB**. BullMQ guarda cada trabajo, su
resultado y un stream de eventos, así que sin techo la cola puede llenar la
base y, con `noeviction`, Redis empieza a **rechazar escrituras**: el análisis
falla con un error opaco.

La limpieza vive en `src/postulaciones/cola-mantenimiento.service.ts` y tiene
tres capas:

| Capa | Cuándo | Qué hace |
| --- | --- | --- |
| Retención al encolar | Siempre | Un trabajo terminado se guarda 24 h y como máximo 200 completados / 100 fallidos |
| Barrido | Al arrancar y cada 30 min | Borra terminados de más de 24 h; si Redis pasa el 85%, baja la gracia a 10 min |
| Guardia | Antes de encolar | Al 85% limpia; si sigue al 95%, responde **503** con "la cola está llena, probá en unos minutos" |

La gracia de 10 minutos en las limpiezas de emergencia existe porque la landing
consulta el resultado del trabajo después de que termina: borrarlo en el acto
rompería ese poll.

`REDIS_MEMORY_LIMIT_MB` ajusta el límite cuando `maxmemory` viene en 0. Por
defecto son 30 MB, que es el plan free.

> **No cambies la política de desalojo a `allkeys-lru`.** BullMQ necesita
> `noeviction`: si Redis desaloja claves de la cola, los trabajos quedan en un
> estado inconsistente y se pierden sin error visible.

Si la base ya está llena y querés recuperarla sin esperar al barrido: reiniciar
el servicio en Render dispara un barrido al arrancar.

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
