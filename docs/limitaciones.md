# Limitaciones conocidas de la extracción

Notas honestas de lo que el extractor no logra todavía. Todo esto está
visible para la persona usuaria de alguna forma (denominador del plan,
tecnologías vacías), no se esconde.

## Páginas donde el extractor no detecta tecnologías

Detectado con ofertas reales de greenhouse (nov 2026):

- `job-boards.greenhouse.io/brex/jobs/8815443002` — Software Engineer II, Backend
- `job-boards.greenhouse.io/brex/jobs/8815438002` — Software Engineer II, Backend
- `job-boards.greenhouse.io/elastic/jobs/8303806` — Platform Infrastructure Engineer

La postulación se crea correctamente (201, `ENVIADO`) pero
`tecnologias: []`, así que esas ofertas no suman cobertura en el plan.
El denominador sigue siendo real: el plan dice "X de N ofertas" con el N
que entró completo, y las tecnologías vacías no inflan tema alguno.

Hipótesis (sin confirmar):

- Parte del cuerpo del aviso vive renderizado por JS o en secciones que
  `cheerio` limpia junto con el ruido.
- El texto llega pero no contiene keywords del vocabulario del
  `technology-extractor.helper.ts` (o usa sinónimos fuera del espejo de
  `web/lib/vocab.ts`).

Posible mejora futura (opcionales, decisión de costo cada una):

- Parsear el JSON-LD que greenhouse embebe en la página
  (`<script type="application/ld+json">`) como fuente de title/company
  además del texto.
- Ampliar vocabulario con sinónimos frecuentes de estos avisos.

## Bloqueos anti-bot al scrapear

`arbeitnow.co.uk` devolvía 403 al User-Agent Chrome/91 que mandaba el
scraper; se actualizaron los headers (Chrome/131 + Accept +
Accept-Language) en `job-analyzer.service.ts` (commit `d86183d`). Si
algún tablero vuelve a bloquear, el aviso cae en `fallidas` y el plan lo
excluye con su denominador reducido — nunca se inventa una oferta que no
se pudo leer.

