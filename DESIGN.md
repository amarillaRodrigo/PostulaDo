---
name: PostulaDo
description: Dejá de adivinar qué estudiar — un plan de estudio construido con las ofertas que vos ya estás mirando.
colors:
  paper: "#f5f3ee"
  paper-raised: "#ffffff"
  paper-alt: "#f6f7f9"
  ink: "#16181a"
  ink-deep: "#16181a"
  ink-soft: "#61656b"
  ink-faint: "#8c8e92"
  terracotta: "#d9542b"
  terracotta-ink: "#a83c18"
  terracotta-soft: "#fbede6"
  sage: "#cfe0c9"
  periwinkle: "#dcdff2"
  lens-light: "#c9c2b2"
  lens-mid: "#8e887a"
  lens-deep: "#45423c"
  spectrum-blue: "#2563eb"
  spectrum-cyan: "#22d3ee"
  spectrum-ice: "#a5f3fc"
  spectrum-blush: "#fbcfe8"
  spectrum-magenta: "#e879f9"
  spectrum-violet: "#c084fc"
  spectrum-orange: "#fb923c"
  spectrum-amber: "#f59e0b"
typography:
  display:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "clamp(32px, 8.6vw, 78px)"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "-0.04em"
  headline:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "46px"
    fontWeight: 800
    lineHeight: 1.06
    letterSpacing: "-0.035em"
  title:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "19px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.015em"
  body:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 700
    letterSpacing: "0.12em"
  mono:
    fontFamily: "Consolas, Courier New, monospace"
    fontSize: "13px"
    fontWeight: 400
    letterSpacing: "0.02em"
rounded:
  sm: "10px"
  md: "14px"
  lg: "15px"
  pill: "999px"
spacing:
  page-inset: "64px"
  section: "84px"
  card-gap: "22px"
  card-pad: "26px"
  control-pad: "10px 18px"
components:
  button-ink:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    rounded: "{rounded.sm}"
    padding: "10px 18px"
  button-ink-hover:
    backgroundColor: "#000000"
    textColor: "{colors.paper}"
  button-ghost:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "10px 18px"
  button-caustic:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    rounded: "{rounded.sm}"
    padding: "10px 18px"
  input-text:
    backgroundColor: "{colors.paper-raised}"
    textColor: "{colors.ink}"
    rounded: "8px"
    padding: "11px 13px"
  chip:
    backgroundColor: "{colors.paper-raised}"
    textColor: "{colors.ink-soft}"
    rounded: "8px"
    padding: "6px 11px"
  card-plan:
    backgroundColor: "{colors.paper-raised}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "22px"
---

# Design System: PostulaDo

## Overview

**Creative North Star: "La Lente y el Prisma"**

PostulaDo se ve como **un instrumento óptico**, no como un sitio de producto. La idea que ordena todo: el usuario trae un lote de ofertas —información cruda, separada, sin leer— y el producto lo hace pasar por un prisma. La luz blanca entra, y sale descompuesta en los temas que la cubren. Esa es la metáfora del producto (de una bolsa de postings a un plan de estudio) y también la del diseño: **el bundle de color no es un acento, es una física**.

El papel cálido y la tinta profunda son el ground. Todo lo demás —la lente, el haz, la retícula, las barras— es **material óptico**: cristal, luz, cáusticas. La página no decora con luz; usa la luz para explicar el mecanismo. Por eso el único elemento policromático del sistema es el espectro, y por eso está racionado a cuatro usos.

El tono es **serio sin ser frío**. La persona que llega está buscando trabajo: no necesita que la alegren ni que la impresionen, necesita que le digan la verdad y le den un plan. Por eso no hay gradientes de vidrio, ni íconos genéricos, ni emojis, ni testimonios inventados: la credibilidad del producto sale de que **los porcentajes son del lote de ella y el denominador está siempre a la vista**.

**Key Characteristics:**
- Un solo gesto visual: la luz que se dispersa. Se repite, no se decora.
- Papel y tinta como ground; el color llega sólo cuando significa algo.
- El denominador es un dato de diseño, no un dato de negocio: nunca está oculto.
- Nada de prueba social ni métricas de mercado que el producto no pueda respaldar.

## Colors

Papel cálido y tinta profunda; el color aparece únicamente donde hay información que lo merece.

### Primary
- **Terracota** (#d9542b): el acento de marca. Marca los nodos de proceso, el borde de foco y los números de paso. Nunca aparece en superficies grandes.
- **Terracota de texto** (#a83c18): la versión oscurecida de la anterior, para texto pequeño sobre papel — la terracota pura sólo llega a 3.6:1 sobre papel y no sirve para leer.

### Secondary
- **Salvia** (#cfe0c9): la banda de cifras. Una sola banda, sin texto de color encima.
- **Periwinkle** (#dcdff2): la banda de cierre (CTA). Contrapunto frío de la salvia.

### Tertiary
- **Espectro** (azul #2563eb → cian #22d3ee → hielo #a5f3fc → blanco → rubor #fbcfe8 → magenta #e879f9 → violeta #c084fc → naranja #fb923c → ámbar #f59e0b): el acento del producto. Se usa en **tres lugares y sólo tres**: el haz de la lente, el relleno de las barras de cobertura y la cáustica del botón. Los dos stops claros (hielo, rubor) no sirven como color de dato sobre papel — por eso los temas `cache` y `frontend` tienen su propio valor opaco (#0e8fa8, #d63a8a) en lugar de tomarlos del espectro.

### Neutral
- **Papel** (#f5f3ee): el ground de la página.
- **Papel elevado** (#ffffff): tarjetas y campos.
- **Tinta** (#16181a): texto principal y botones primarios.
- **Tinta suave** (#61656b): texto secundario, sobre papel da 5.3:1.
- **Tinta tenue** (#8c8e92): sólo para elementos decorativos, nunca para texto de lectura.
- **Lente** (#c9c2b2 → #8e887a → #45423c): el ground óptico del hero, en degradado radial.
- **Reglas** (rgba(22,24,26,.10)): separadores de 1px.

### Named Rules

**The Four-Use Rule.** El espectro aparece en exactamente cuatro lugares, y ninguno más: el haz de la lente, el relleno de las barras de cobertura, la cáustica del botón y el subrayado de la palabra del titular. Un quinto uso lo convierte en decoración.

**The Denominator Rule.** Todo porcentaje lleva su denominador al lado. Un número sin el lote al que corresponde es ruido, no información.

**The One-Ink Rule.** Los botones y los datos son tinta o papel. El color de marca sólo aparece en el acento de marca, nunca como relleno de una superficie grande.

**The Opaque-Data Rule.** Un color de dato sobre papel tiene que pasar 4.5:1. Los dos stops claros del espectro (hielo, rubor) y el cian no sirven: los temas que los necesitan usan su propio valor opaco (`cache` #0e8fa8, `ci` #0e7490, `frontend` #d63a8a).

## Typography

**Display Font:** Geist (con fallback `system-ui`)
**Body Font:** Geist (con fallback `system-ui`)
**Label/Mono Font:** Consolas / Courier New

**Character:** una grotesca geométrica única para todo el sistema —sin serifas, sinDidone— con la mono reservada estrictamente para datos, medidas y URLs. El contraste no viene de mezclar familias: viene de que la mono aparezca sólo cuando hay un número o una coordenada.

### Hierarchy
- **Display** (800, clamp(32px, 8.6vw, 78px), 1.0, -0.04em): el titular del hero, en dos líneas, siempre.
- **Headline** (800, 46px → 30px en móvil, 1.06, -0.035em): los titulares de sección. Centrados, sin eyebrow arriba.
- **Title** (700, 18–22px): títulos de tarjeta y de tema.
- **Body** (400, 14.5–17px, 1.55): prosa. Medida máxima ~65ch.
- **Label** (700, 11–13px, .12–.22em, uppercase): etiquetas de campo y rótulos. Nunca como kicker sobre un titular.
- **Mono** (400, 12–13px, tabular-nums): URLs, porcentajes, medidas y el ID del proyecto.

### Named Rules

**The No-Kicker Rule.** Ningún titular lleva una etiqueta o un eyebrow encima. El titular lleva su propio peso; los rótulos van debajo o al lado.

**The Data-Is-Mono Rule.** Si el texto es un dato —un porcentaje, una URL, un identificador— va en mono con cifras tabulares. Si es una frase, va en Geist.

## Layout

Contenedor de **1180px** con inset de página de 64px (40px en móvil). Las secciones alternan paper, paper-elevated, banda salvia, banda periwinkle y un bloque deep-ink; cada banda tiene su propio rhythm vertical de 84px.

El hero es **un panel a sangre** de una pantalla con la lente como ground, y el contenido vive dentro del contenedor de 1180px. Debajo, todo el sitio es una pila de secciones centradas con contenido de 720–1080px.

Dos grillas: `grid2` para las tarjetas de tema (dos columnas) y la tira de chips como flex-wrap. El "flow" de los tres pasos es una línea de 1px con nodos de 23px: no son tarjetas, son una secuencia.

**Breakpoints:** 1080px (el shotcard pasa a una columna), 860px (nav a menú `<details>`, flow apilado, prism scrolleable con retícula de 76px, titulares a 30px), 520px (nav y captions más chicos).

## Elevation & Depth

Sistema **híbrido**: las superficies están planas por default (paper y paper-elevated con un borde de 1px), y la sombra aparece sólo donde hay jerarquía real — una tarjeta de producto y el panel del formulario, que flotan sobre el papel.

### Shadow Vocabulary
- **Ambient** (`0 1px 2px rgba(22,24,26,.04), 0 8px 24px rgba(22,24,26,.06`): tarjetas.
- **Lift** (`0 18px 48px rgba(22,24,26,.12`): el shotcard del producto.
- **Hero** (`0 24px 60px rgba(0,0,0,.35`): el panel del formulario sobre la lente — la única sombra profunda del sistema, porque es lo único que flota sobre un ground oscuro.
- **Caustic** (`0 0 0 transparent + un filete espectral de 2px y un derrame `blur(11px)` bajo el botón): no es sombra, es luz.

### Named Rules

**The Flat-By-Default Rule.** Nada tiene sombra en reposo salvo que sea una capa sobre otra capa. Las sombras no son textura.

**The Border-Not-Shadow Rule.** Una tarjeta lleva borde de 1px **o** sombra, nunca las dos. El borde y la sombra juntos producen la "carta fantasma".

## Shapes

Radio 10px en controles, 14px en tarjetas, 15px en el shotcard, 999px en chips. Sin esquinas punteadas ni formas orgánicas: todo es recto salvo el radio. La retícula de la lente (76px, 10% de opacidad) es la única textura de la página y existe porque la lente es un instrumento de medición.

## Components

### Buttons
- **Shape:** radio 10px, sin borde visible salvo en el ghost.
- **Primary:** tinta `#16181a` sobre papel, texto paper, padding `10px 18px`.
- **Hover / Focus:** el primary va a `#000`; el foco es un anillo de 2px en azul `#2563eb` con offset 3px, visible sobre cualquier ground.
- **Ghost:** borde de 1px, fondo transparente.
- **Caustic (el CTA principal):** placa de tinta con un filete espectral de 2px en el canto inferior y un derrame difuso del espectro por debajo. El botón refracta la luz; no está pintado de color.

### Chips
- **Style:** borde 1px, fondo paper-elevated, radio 8px, mono 12.5px en tinta suave.
- **State:** la tira de tecnologías es puramente informativa; los chips no son filtros ni acciones.

### Cards / Containers
- **Corner Style:** 14px.
- **Background:** paper-elevated con borde de 1px.
- **Shadow Strategy:** ninguna (ver Elevation).
- **Border:** 1px `rgba(22,24,26,.10)`.
- **Internal Padding:** 22–26px.

El acento de un tema **no** se marca con una franja lateral: se marca con un swatch de 10px junto a su porcentaje. Una franja de color de 3px en el borde de una tarjeta es el tell más reconocible de una UI generada.

### Inputs / Fields
- **Style:** borde 1px, fondo paper-elevated, radio 8px, padding `11px 13px`.
- **Focus:** anillo de 2px azul, offset 2px.
- **Placeholder:** tinta suave a opacidad 1 — nunca el gris por defecto del navegador.
- **Label:** siempre un `<label>` real. El placeholder no es un nombre.
- **Error:** fondo `#fdf1ec` con texto `#8c2f16` y `role="alert"`.
- **Disabled:** fondo `#2b2e31`, texto `#9aa0a6`, cursor `progress`, y la cáustica se apaga.

### Navigation
- **Style:** 68px, papel al 86% con `backdrop-filter: blur(12px)` y borde inferior de 1px. Wordmark en 19px/800 con tracking -0.02em.
- **Estados:** los links de sección no tienen hover; el CTA de la nav es tinta.
- **Mobile:** los links se ocultan y aparece un `<details>` con un panel de 190px alineado a la derecha.

### La Lente (signature)
El hero: degradado radial `--lens-1 → --lens-3` con una retícula de 76px al 10% (máscara radial), el haz de 7 capas de 14px con `blur(18px) saturate(.7)` divergiendo desde el 30% izquierdo, saturación total 42%, núcleo blanco al 58%. El haz respira: 28s de deriva, no un loop de scroll.

### El Prisma (signature)
SVG de 1240×250: un haz blanco entra por la izquierda, un triángulo lo dispersa, y sale un rayo por tema. **El largo del rayo es el porcentaje.** Conectores punteados a una columna fija de etiquetas.

### El Botón-Cáustica (signature)
Placa de tinta, `::after` con un gradiente espectral de 2px en el canto inferior y `::before` con el mismo gradiente desenfocado 11px que se derrama por debajo, respirando a 7s.

## Do's and Don'ts

### Do:
- **Do** mostrá el denominador junto a cada porcentaje: "5 ofertas" al lado de "100%".
- **Do** rotulá como **Ejemplo** cualquier dataset que no venga de un lote real del usuario.
- **Do** usá el espectro para marcar información (cobertura, dispersión, cáustica), nunca para decorar.
- **Do** mantené el foco visible en todo control: anillo de 2px azul.
- **Do** reduuí el largo del rayo del prisma al porcentaje, y el del texto al dato real.
- **Do** derivá el número de tecnologías del extractor real, no de un número escrito a mano.

### Don't:
- **Don't** pongas un eyebrow, un kicker o una etiqueta encima de un titular.
- **Don't** uses texto con gradiente: el énfasis viene del peso o del tamaño.
- **Don't** uses una franja de color de más de 1px en el borde de una tarjeta.
- **Don't** uses caracteres unicode como íconos; los íconos se dibujan.
- **Don't** inventes testimonios, logos de clientes, precios ni estadísticas de mercado.
- **Don't** prometas análisis en background ni notificaciones que el producto no tiene.
- **Don't** uses los dos stops claros del espectro como color de un dato sobre papel.
- **Don't** muestres un porcentaje sin el lote al que corresponde.
