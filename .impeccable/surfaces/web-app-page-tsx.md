---
version: 1
slug: "web-app-page-tsx"
primary_target: "web/app/page.tsx"
related_targets: []
---

# Superficie: Landing de PostulaDo

Ruta principal: `web/app/page.tsx` — la landing por secciones del MVP (lote de ofertas → plan de estudio).
Modo: **Persuade**. El visitante debe entender el mecanismo y pedir su plan.

## Audiencia

Profesional de IT en búsqueda activa, con tiempo y paciencia escasos. Llega con un lote de URLs y una duda
concreta: *qué aprendo primero*. Sale con un plan ordenado y un porcentaje de cobertura.

## Trabajo y acción

Trabajo: dejar de adivinar el camino de aprendizaje.
Acción: pegar sus URLs y pedir su plan (CTA "Ver mi plan").

## Prueba y contenido

La prueba es el mecanismo, no el marketing: la lente con el haz dispersando el lote, y el diagrama de prisma
que muestra luz blanca entra → un rayo por tema → el largo del rayo es el porcentaje. Contenido real
disponible: las 36 tecnologías del extractor (`technology-extractor.helper.ts`) y la taxonomía de 8 oficios
(`src/common/taxonomy.ts`). **Sin testimonios, sin logos de clientes, sin cifras de mercado inventadas** — el
lote de demostración va rotulado como EJEMPLO en todas las partes donde aparece.

## Dirección elegida

La lente de vidrio con haz dispersivo sobre el ground "Papel", y el botón como prisma de canto (placa de
tinta con filete espectral y derrame de luz bajo el borde). CTA tratamiento **A**.

## Momento memorable

El haz: la luz entra como blanco y sale descompuesta en los temas que cubren las ofertas. Es el mecanismo
literal de la promesa, y el botón es donde esa luz se refracta.

## Decisiones sin cerrar

- Target de deploy: sin definir (por defecto, Vercel).
- La ingesta por lote se hace con N `POST /postulaciones` concurrentes desde la ruta proxy
 (`web/app/api/lote/route.ts`), no con un endpoint bulk propio. El proxy es necesario porque la API
 NestJS no tiene CORS.
- El proxy **bloquea** el request mientras espera el análisis: el hero ya no promete que corra en
 background. Convertirlo en asíncrono real (202 + jobId + polling del cliente) es el siguiente paso
 natural y está sin decidir.
- `birthDate` es obligatorio en el modelo de usuario y no se usa en ninguna lógica: por eso el formulario
 de cuenta lo pide de verdad en vez de mandar una fecha falsa.
- Si la etapa de carta/CV sigue viva después del MVP: sin definir.

## Direction contract

**THESIS**
Una lente con luz de verdad: el lote entra como luz blanca y sale descompuesto en los temas que lo cubren.
El sitio no describe una herramienta de IA — hace que veas la física de lo que hace. Rechaza el arreglo por
defecto de la categoría: titular enorme + chat bubble + tres tarjetas con íconos + testimonios inventados.

**OWN-WORLD**
Papel cálido `#f5f3ee` y tinta `#16181a` como únicos grounds; el hero es una lente óptica con rejilla al
10%. El único elemento policromático del sitio es el **ESPECTRO** (azul `#2563eb` → cian `#22d3ee` → blanco →
magenta `#e879f9` → violeta `#c084fc` → naranja `#fb923c` → ámbar `#f59e0b`), usado en tres lugares y sólo
tres: el haz, las barras de cobertura y la cáustica del botón. El botón es una placa de tinta con un filete
espectral de 2px y un derrame difuso bajo el borde. Cards de 14px, sombras suaves, sin gradientes de
vidrio, sin pills, sin íconos genéricos, sin sparkles. Dos stops claros del espectro (hielo, rubor) no
sirven como color de dato sobre papel: los temas `cache` y `frontend` llevan su propio valor opaco.

**STORY**
Entiende que las ofertas que ya está mirando dicen qué tiene que aprender, pero separadas no lo dicen.
Cree que el producto le dice qué aprender primero y por cuál puerta entrar, sin atarlo a un vendor.
Hace: pega sus URLs y pide su plan.

**FIRST VIEWPORT**
Nav de 68px sobre papel translúcido con blur de 12px, wordmark "POSTULADO" a la izquierda, links de
sección al centro y el CTA "Ver mi plan" en tinta a la derecha. Debajo, la **LENTE** a sangre: degradado
radial `#c9c2b2 → #8e887a → #45423c` con rejilla de 88px al 10% y máscara radial. Encima el **haz**: siete
capas de 14px con blur 18px que divergen desde el 30% izquierdo, saturadas al 42%, con núcleo blanco al
58%, cruzando el titular en diagonal de −4°; deriva de 28s. Titular centrado en dos líneas de 78px:
"Dejá de adivinar / qué estudiar", con "qué estudiar" subrayado por un filete espectral de 5px. Bajada de
19px en dos líneas. Debajo del titular, la línea de audiencia "Para profesionales de IT en búsqueda activa"
en un chip de tinta al 30% (texto blanco, 6.5:1). Después, el panel del formulario: tarjeta de 720px,
blanco al 96%, borde de 1px y sombra `0 24px 60px rgba(0,0,0,.35)`, con cabecera "OFERTAS (URL)" /
"UNA POR LÍNEA · PEGÁ LAS TUYAS", cinco líneas monoespaciadas editables, y pie con "Vas a obtener: el
tipo de trabajo que comparten, los temas que lo cubren y por cuál empezar." a la izquierda y el BOTÓN a
la derecha — placa de tinta, radio 10px, con la cáustica espectral en el canto inferior y el derrame
respirando a 7s. Microcopy debajo: "Tu lote queda guardado, así que el próximo lo comparás contra este".

**FORM**
La lente con haz dispersivo y el botón-caústica. Brief-pinned por el usuario el 07/11/2026 a partir de su
referencia (hero con haz prismático); desplaza la dirección que el roll asignaba (el despiece técnico,
índice 6), porque el brief fijó el registro popular de landing y el gesto del prisma.
SEED REFERENCE: seed:f5dbafb413feea63

**FINISH**
unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and
every shipping raster carrying its provenance
