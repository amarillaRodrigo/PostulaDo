---
target: Tu plan / RutaPlan (ruta de aprendizaje)
total_score: 21
max_score: 40
na_heuristics: 
p0_count: 3
p1_count: 3
target_identity: "file:D:\\programacion\\PostulaDo\\web\\components\\RutaPlan.tsx"
target_fingerprint: "sha256:e4a7111ffe612cdfd44fe1c75f0944301228b7b7956dd4394ee73b0d1687d116"
target_path: "D:\\programacion\\PostulaDo\\web\\components\\RutaPlan.tsx"
timestamp: 2026-11-08T08-15-30Z
slug: web-components-rutaplan-tsx
---
# Critique — "Tu plan" / RutaPlan (PostulaDo)

Target: `web/components/RutaPlan.tsx` · Surface mode: **Operate** · Method: dual-agent (A: design review · B: detector v4.8.0)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | `.ruta__estado` (`globals.css:792-807`) is a 19px hairline that changes only on hover; `is-curso` (`:809-812`) differs by border colour alone; no node is marked current. "Empezá acá" fires on two nodes at once. |
| 2 | Match System / Real World | 2 | Excellent domain vocabulary, but the ordering rule is invisible: "Pruebas automatizadas" (0%) sits at route position 6 while the table above ranks it last, explained only by a 11.5px ink-soft line. |
| 3 | User Control and Freedom | 2 | The 3-state cycle (`RutaPlan.tsx:29-33`) makes undo take 3 clicks; no collapse, no filter, progress is localStorage-only while `LoteForm.tsx:1034` promises cross-device access. |
| 4 | Consistency and Standards | 2 | The same datum is mono/tabular in the table (`.cov__pct`, `:1885-1892`) and sans/non-tabular in the route (`.ruta__cobertura`, `:779-785`) — violates DESIGN.md:181. The nested "Dónde leer" summary inherits `.ruta summary`'s flex layout through a descendant selector. |
| 5 | Error Prevention | 3 | Robust read-mostly panel: empty state, failure state, defensive `localStorage` parsing. No destructive path. |
| 6 | Recognition Rather Than Recall | 2 | Eight topics appear twice, in different orders; graph edges are plain-text names with no visual link to their nodes. |
| 7 | Flexibility and Efficiency of Use | 2 | No collapse, no filter, no jump-to-node, no batch action, no "mark node done". ~7000px of continuous scroll at 390px. |
| 8 | Aesthetic and Minimalist Design | 1 | 8 fully-expanded nodes × (header + meta + objetivo + 6 steps + 2 edge lines + disclosure). Eight identical sage "Tu próxima acción" bands fire at once, so nothing is primary. |
| 9 | Error Recovery | 2 | `cargandoRuta` (`:125-134`) returns early on `falla` — the failure message is terminal for the tab; no retry button. |
| 10 | Help and Documentation | 3 | Rich in-context help, but nothing explains the three states and nothing says the progress is device-local. |
| **Total** | | **21/40** | **Acceptable** (20–27), bottom of band |

## Design Specificity Verdict

~70% authored, ~30% category-default. The prose and data model are unmistakably this product
(`RutaPlan.tsx:8-9,16-18`; `ruta.ts:3-8,29-34`; the ghost-node sentence `:138`). The rendering is a
generic accordion checklist: `<details>`/`<summary>` with a `+`/`–` glyph reused in three unrelated
places, a generic three-state cycling pill, and eight structurally identical node cards that flatten
a rich `NodoRuta` into one repeated anatomy. **The world never arrives**: `DESIGN.md:132` reserves
terracotta for "los nodos de proceso, el borde de foco y los números de paso" — the route is made of
process nodes and step numbers and uses neither. The "oficio" metaphor exists only in code comments.

**Deterministic scan:** 89 findings on the live panel (75 panel-scoped), 84 warning / 5 advisory.
`undersized-ui-text` 38, `tiny-text` 28, `nested-cards` 8, `low-contrast` 1 in-panel, rest in the
landing (out of scope). False positives: `codex-grid-background` (the lens reticle, by design),
`cream-palette` (`--paper` is the canonical token). Static `.tsx` scans are regex-only in this
engine, so the "0 findings" on `web/components` is a mode limitation, not a clean bill of health.

## Overall Impression

The panel answers "what should I learn first" and then buries it. The peak — "Backend y APIs,
Empezá acá, 100%, Tu próxima acción: Elegí un recurso de un dominio…" — is well executed and
genuinely actionable. The valley starts one node later, when node 2 looks exactly like node 1 and
also says "Tu próxima acción". Eight identical green bands mean the single decision the product
exists to make dissolves into a checklist. The single biggest opportunity: make the route a
syllabus you read top-to-bottom instead of a wall you scroll through.

## What's Working

1. **The "Tu próxima acción" band** (`RutaPlan.tsx:282-286`, `globals.css:932-941`) — the best
   decision in the product. It converts a topic list into an action, names it in the user's voice,
   and uses the system's existing sage band instead of inventing colour or shadow. Its only fault
   is that it fires 8× at once.
2. **The graph shipped as vocabulary, not a diagram** (`RutaPlan.tsx:296-315`, `ruta.ts:161-170`,
   `cierreDePrerequisitos` `ruta.ts:333-350`) — a vendor-neutral way to put a DAG into a static
   export, and it closes the corpus over prerequisites so a 0% topic appears with an honest reason
   instead of being silently dropped.
3. **The step-level resume logic** (`proximoPaso` `:116-121`, `aria-pressed` `:272`, defensive
   `localStorage` reader `:47-80`) — small, correct, uses the one band properly.

## Priority Issues

### [P0] 1 — The route renders all eight nodes fully expanded; the only accordion is the least important content
- **What**: `RutaPlan.tsx:201-334`. Every node unconditionally renders `.ruta__caja` → `.ruta__plan`
  → all `plan.pasos` → edges → the sources disclosure. The only `<details>` is
  `.ruta__fuentes-desplegable` (`:317`). The route `<details className="ruta">` starts closed
  (`:158-172`), so the core deliverable hides behind a 12.5px summary row.
  Measured: 3185px of route in a 720px panel (4037px total); ~7000px at 390px.
- **Why it matters**: the visitor's job is *"decide what to study FIRST"*. `PRODUCT.md:23` promises
  "a short, ordered, evidence-backed list of what to learn"; this is the opposite of short.
- **Fix**: node as the accordion unit, one open (the first not-`lista` node); closed node = one
  ~40px row; the whole path on one screen; the outer `<details>` open by default. Borrowed from
  Codecademy's one-open-section syllabus and roadmap.sh's collapsed node cards; translated because
  the indicator is a drawn chevron, not the platform triangle, and the open node is marked by ink
  weight + the sage band — no shadow, no 3px colour stripe.

### [P0] 2 — "Dónde leer": invisible, and its indicator lies about its own state
- **What**: `globals.css:665-691, 957-973` + `RutaPlan.tsx:317-329`. (a) `.ruta summary` is a
  descendant selector, so the nested summary inherits `display:flex; justify-content:space-between`
  and its `::after` glyph is pushed ~600px from its own label; the native marker is hidden at
  `:678-680`. (b) `.ruta[open] summary::after { content:'–' }` (`:689`) matches any descendant
  summary, so every closed "Dónde leer" shows "–" whenever the parent is open — and "+" when the
  parent is closed and the nested one is open. Measured in the live DOM both directions. (c) The
  label is 10.5px `--ink-soft`, below the system's own 11px label floor.
- **Why it matters**: this is the product's only doorway to external learning resources, and a
  10.5px grey dash on a collapsed control teaches the user the row is inert.
- **Fix**: scope the outer rules to `.ruta > summary`; give the nested disclosure its own drawn SVG
  chevron next to the label; raise the label to 12px `--ink`; correct the copy (the list contains
  `tutoriales`, not only docs); move the sources directly under the node header.

### [P0] 3 — The state control is invisible at rest, and no node shows where you are
- **What**: `RutaPlan.tsx:29-33, 232-239`; `globals.css:792-819`. `.ruta__estado` is 11px, 2px 8px
  padding, 1px `var(--rule)` border, transparent → ~19px tall, legible only on hover; `is-curso`
  differs by border colour alone; the next state is disclosed only in the `aria-label`. Separately,
  `RutaPlan.tsx:214` applies `is-raiz` and `is-curso` to the `<li>`, and **no CSS rule exists for
  either** — `is-raiz` is dead code.
- **Why it matters**: on the panel's stated primary device (phone, between tasks) there is no hover.
  The node you are studying looks identical to the ones you have not started. An invisible control
  governing invisible state is the worst kind of surface.
- **Fix**: legible resting state (`--paper-alt` fill, `--ink` text, radius 10px — not 999px);
  selected state readable without colour alone; one-click completion and one-click undo;
  ≥44px touch target; implement `is-raiz` / `is-curso` / `is-lista` / `is-ghost` as real node
  treatments; add `aria-current="step"`; state the global progress with its denominator.

### [P1] 4 — Two lists of the same eight topics, in different orders, in two visual languages
- **What**: table `.cov` (`LoteForm.tsx:891-909`, `globals.css:1867-1898`, sorted by %, mono
  13px/700) vs route (`:201`, topological, sans 11.5px, no bar). They diverge at position 6:
  the table shows "Integración y entrega continua 20%", the route shows "Pruebas automatizadas 0%".
  The only text explaining the reorder is `.ruta__nota` (`:193-199`), 11.5px ink-soft, and it says
  the order is *not* a ranking while the table above is exactly a ranking.
- **Why it matters**: the table looks like the answer, the route looks like a second answer. The
  sharpest contradiction of the product's own thesis, and the concrete form of the complaint.
- **Fix**: make the route the list and the table the evidence (or vice versa); one language for the
  datum (mono/tabular both places); every percentage carries its denominator at the point of
  reading; one lead line above the route ("Empezá por **Backend y APIs** — aparece en 10 de tus 10
  ofertas.").

### [P1] 5 — "Empezá acá" fires twice, and the "next action" fires eight times
- **What**: `ruta.ts:162-163` leaves two roots (`backend: []`, `frontend: []`); `ruta.ts:441` defines
  `empiezaAca` as "no prerequisites", so both nodes get the badge (`RutaPlan.tsx:226-228`) while
  `sugerenciaAprendizaje` says "Empezá por el tema Backend y APIs" — three authorities, three
  answers. Separately, `proximoPaso` (`:115-121`) marks the first undone step *of each node*, so all
  eight nodes render a sage "Tu próxima acción" band and eight "Tu próxima acción" strings reach
  the DOM at once.
- **Why it matters**: the highest-stakes label on screen carries no information; the panel's
  loudest element signals nothing.
- **Fix**: one root; one global next action; a completed node says "6 de 6 pasos".

### [P1] 6 — The whole panel is below the legibility floor, and the route has no responsive rules at all
- **What**: measured computed sizes in the panel — 10.5px (`.ruta__tipo`, `.ruta__plan-horas`,
  `.ruta__badge`, `.ruta__fuentes-desplegable > summary`), 11.5px (`.ruta__plan-objetivo`,
  `.ruta__relacion`, `.ruta__nota`, `.ruta__meta`, `.ruta__cobertura`, `.ruta__fuentes a`),
  9.5px (`.ruta__paso-marca`). **No element in the panel reaches 12px**, against DESIGN.md's Body
  14.5–17px / Label 11–13px. The six `@media` blocks (`globals.css:1557, 2472, 2497, 2516, 2638,
  2663`) contain **zero** `.ruta*` rules. Also `low-contrast`: `.ruta__nodo.is-ghost
  .ruta__cobertura` (`:787-790`) applies `opacity: 0.6` to `--ink-soft` → **2.56:1** (detector
  measured 2.5:1); required 4.5:1.
- **Why it matters**: `PRODUCT.md` (Accessibility & Inclusion) requires the corpus summary to stay
  legible and operable at phone widths. On a 390px screen `.ruta__caja-top` (flex, 4 children, no
  wrap) breaks the title across two lines with the badge, % and chip crammed onto the first; the
  steps — the app's primary content — are 11.5px.
- **Fix**: raise the route to the system scale; add the missing `@media (max-width: 860px/520px)`
  block with a stacked node header and 44px targets; drop the opacity trick on the ghost coverage.

### [P2] 7 — Dependencies buried under six steps; numbering restarts; hours never aggregated
- **What**: `RutaPlan.tsx:296-315` puts "Conviene antes" / "Te prepara para" *after* the ~280px plan
  box, and "Te prepara para" lists up to four themes in `<b>` (full ink) — the heaviest text in the
  node, about the future rather than the action. Each node has its own `<ol>` of 1..N
  (`:256-292`) → eight "1"s on screen. `plan.horas` is per node and never summed. The only global
  progress is "{n} listas" (`:167-171`), without a denominator and only when n > 0.
- **Fix**: dependency moves to the node header; continuous step numbering with the total; summed
  and remaining hours in mono; global progress "3 de 8 temas · 11 de 37 pasos · 34 h".

### [P2] 8 — An unvalidated cast takes the whole app down, and the route's failure is terminal
- **What**: `api.ts:541-559` casts the response of `/auth/sesiones` to `SesionAbierta[]` with no
  runtime check; `CuentaPanel.tsx:565` calls `sesiones.map(...)` unguarded; the app has **no
  `error.tsx` / `global-error.tsx`** (`web/app/` holds only `globals.css`, `layout.tsx`, `page.tsx`,
  `recuperar/`, `verificar/`), so the whole tree unmounts and the user gets a blank page.
  **Reproduced live**: `Uncaught TypeError: sesiones.map is not a function` → blank page.
  Same pattern in `listarLotes()` (`api.ts:500-507`) and `listarPostulaciones()` (`api.ts:670-691`).
  Separately, `RutaPlan.tsx:125-134` makes the route's failure message terminal for the tab.
- **Fix**: validate arrays at the API edge; guard the render; add error boundaries; give the route
  a real retry.

### [P3] 9 — The accent the system reserved for this surface is unused, and three forbidden idioms are present
- **What**: `DESIGN.md:132` reserves terracotta for "los nodos de proceso, el borde de foco y los
  números de paso"; the whole `.ruta` block uses it only as the badge's text colour (`:776`).
  `RutaPlan.tsx:279` renders `'✓'` (unicode icon — forbidden by `DESIGN.md:275`).
  `globals.css:775` and `:798` use `border-radius:99px` pills on a surface whose contract says
  "sin pills". `.ruta__plan` (`:866-872`) is a bordered card nested inside the bordered `.ruta__caja`
  (`:752-756`) — 8× (detector `nested-cards` ×8). `.ruta__punto` (`:746`) knocks out the spine with
  a **white** `--card` halo over warm `--paper`. The spine (`:727`) is `var(--rule)` ≈ `#e8e8e8`.
  Step hover (`:915`) is `rgba(0,0,0,.03)`. The route `<details>` marker is a text glyph.
- **Fix**: terracotta on the step numbers and the process marker (the theme swatch moves next to
  the % per `DESIGN.md:233`); draw the check; drop the inner card border; fix the halo and the
  spine; make the step hover visible.

## Persona Red Flags

**Casey (Distracted Mobile User)** — the declared primary persona (`PRODUCT.md:100`).
~7000px of continuous route at 390px with zero collapse and zero media-query support; step buttons
at ~23px (`:904`); the state control's only affordance is hover (`:804-807`), which does not exist
on touch; "Dónde leer" at 10.5px with a dash 600px away; on return there is no "continue where you
left off" because `listasCount` only appears when a node is `lista`. Breaks at: finding step 1,
and marking progress.

**Sam (Accessibility-Dependent User)** — state conveyed by hover only, and `is-curso` by border
colour alone (meaning by colour alone); a `✓` unicode glyph announced before the text; the step
mark at 9.5px dependent on shape; a collapsed "Dónde leer" announcing "–" while closed; no
`<h3>` anywhere in `RutaPlan.tsx`, no `aria-current` on the node the user is supposed to be on, and
~80 tab stops across the route. Breaks at: knowing where you are, and every status readout.

**Jordan (Confused First-Timer)** — "Empezá acá" appears twice, and the note above the route says
the order is not a ranking while the table above is sorted by the ranking; the prerequisite edges
name other cards with no visual link; the ghost node reads as a required step because only its
percentage is dimmed; "Pendiente / En curso / Lista" are never defined. Breaks at: the first
decision the panel exists to make.

## Minor Observations

1. `.ruta__badge` (`:775`) has `border-radius:99px` with **no background and no border** — the
   radius renders nothing; "Empezá acá" is terracotta text pretending to be a badge.
2. `.ruta__estado` (`:798`) is a 99px pill on a surface whose contract says "sin pills".
3. `.ruta__paso-marca` (`:927-929`) draws the step number at 9.5px ink-soft.
4. `.ruta__lista::before` (`:727`) draws the spine at `var(--rule)` ≈ `#e8e8e8` on white.
5. `.ruta__punto` (`:746`) uses a white `--card` halo over warm `--paper`.
6. `.ruta__paso-boton:hover` (`:915`) is `rgba(0,0,0,.03)` — invisible.
7. `.ruta__plan` (`:866-872`) nests a second 1px border + its own background inside `.ruta__caja`.
8. `RutaPlan.tsx:251-253` renders "≈ 20 h en total" in sans 10.5px; `DESIGN.md:181` puts
   measurements in mono.
9. `RutaPlan.tsx:229-231` + `:243` render the same fact twice, in two type styles, three lines
   apart, and the % carries no denominator.
10. `proximoPaso` returns `-1` when a node is complete, so a finished node keeps six struck-through
    rows at full height.
11. `RutaPlan.tsx:35-36` stores progress device-locally while `LoteForm.tsx:1034` invites the user
    to open the plan from any device.
12. `LoteForm.tsx:905-907` truncates the alternatives to two with `.slice(0, 2)`, silently.

## Questions to Consider

1. If the route had to fit on one screen — 720px, eight rows, no scrolling — what would you cut?
2. What if the coverage table were sorted by route position and the percentage became a column
   instead of a bar? Would the reader lose anything, or would "the table" simply become "the route,
   indexed"?
3. The content is a graph; the rendering is a list. roadmap.sh draws the graph. PostulaDo's world
   forbids chromatic decoration but not drawing — what if "Conviene antes / Te prepara para"
   became a real 2px neutral connector, with the 0% node visibly hanging off Backend and Frontend?
4. The state control is the least visible and least reliable part of the panel, and the only thing
   the user owns. Progress lives in localStorage; the plan travels, the progress does not. Is a
   tracker that doesn't travel worth shipping — or should the MVP drop the control and keep the
   panel a pure read of the corpus? That decision would delete three of the priority issues.
5. The product answers "what should I learn FIRST" and there are eight answers on screen. What if
   the panel led with one line and put the eight-node route below it as the detail?
