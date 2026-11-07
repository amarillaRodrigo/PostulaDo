# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Next.js. The frontend is greenfield: the repository contains only the NestJS API, which already exposes the full REST contract the UI needs. Deploy target is **undecided** (the user did not name one; Vercel is the default fit for Next.js but was not confirmed).

## Users

**Primary:** an IT professional in active job search (the MVP is scoped to IT only). They are pursuing a concrete goal, use the tool under time pressure, and need a usable answer rather than an exploration. Secondary audiences (recruiters, companies evaluating candidates) are **not** in scope.

## Product Purpose

PostulaDo's MVP answers one question: **given a corpus of real job postings, which skills and topics should I learn to cover the largest percentage of them?** The user brings a batch of postings; the system extracts their requirements, aggregates them, and returns a ranked list with the share of offers each one appears in, plus a learning suggestion grounded in that distribution.

The letter generator, the ATS-optimized CV and the per-application pipeline are **later stages**, not the MVP. The MVP is the aggregate insight: a learner who can see that five topics cover most of the market has something to act on; a learner who gets one well-written letter has one more application.

Success means: the user finishes with a **short, ordered, evidence-backed list of what to learn**, not with a document.

## Positioning

The mechanism is **aggregation over a corpus, not generation over a single document**. Each posting is parsed into a structured requirement set; those sets are then counted across the whole batch and turned into a coverage distribution — the Pareto of the local IT hiring market. A job board shows you postings; a job board does not tell you which four skills those postings have in common. That is the gap.

The product can truthfully claim something a chatbot cannot: its counts are over a **specific corpus the user supplied**, and each percentage is traceable to the postings that produced it. The existing `analisis-aprendizaje` endpoint is the proof.

## Operating Context

- The user arrives with a set of postings — URLs pasted from job boards, aggregators, or company careers pages — often ten to forty of them, gathered over days of browsing.
- The interaction is a **single-task, high-anxiety session**: paste a batch, wait, read the ranked list, decide what to study. It is not a browsing session.
- The whole product is in Spanish (API copy, validation messages, generated documents). The backend stores a `countryCode` on the user, implying locale-sensitive output.
- The vocabulary is deliberately the vocabulary of **job postings**, not of a curriculum: `tecnologías`, `responsabilidades`, `años de experiencia`, `tono de empresa`. The output ranks and groups these; it does not rename them into a pedagogical scheme it invented.
- The AI runs against a self-hosted SGLang server (`SGLANG_URL`), not a hosted vendor.

## Capabilities and Constraints

Confirmed API surface the UI is built on:

| Capability | Endpoint | Notes |
|---|---|---|
| Register / login | `POST /auth/register`, `POST /auth/login` | Returns `access_token` (15m), `refresh_token`, `expires_in` + public user |
| Renew session | `POST /auth/refresh` | Rotates the refresh token; the used one is revoked |
| Log out | `POST /auth/logout` | Revokes the refresh token immediately; idempotent |
| Log out everywhere | `POST /auth/logout-todos` | JWT required; revokes every refresh token of the account |
| List / read / update users | `GET/PUT /usuarios`, `GET /usuarios/:id` | Role-gated (`ADMIN`) and ownership-gated |
| Queue analysis | `POST /postulaciones/analizar` | One URL; returns `{ jobId, status: 'queued' }` immediately |
| Poll analysis | `GET /postulaciones/analizar/status/:jobId` | `waiting \| active \| completed \| failed`; `result` on completion |
| Create application | `POST /postulaciones` | Synchronous; accepts `url` + `title`/`description`; auto-extracts technologies by regex when none are supplied |
| List applications | `GET /postulaciones` | Filters: `status`, `isArchived`; paginated; bare array, no pagination metadata |
| **Corpus analysis** | `GET /postulaciones/analisis-aprendizaje` | **The MVP's core.** Returns `totalApplicationsAnalizadas`, `tecnologiasMasDemandadas: [{ name, count, percentage }]`, `sugerenciaAprendizaje` |

Hard constraints the UI must design around:

- **No bulk endpoint exists.** A batch of N postings must be ingested as N concurrent `POST /postulaciones` calls. A dedicated bulk endpoint is the obvious backend addition; until it exists, the UI owns the concurrency, the partial-failure handling and the progress reporting.
- **The per-posting analysis is asynchronous and slow** (scrape + 4 LLM generations). The aggregate can be computed from `POST /postulaciones` alone, without the LLM path — the technology extractor is a deterministic regex vocabulary, not a model call. That distinction is a product decision, not an implementation detail: a fast corpus scan and a deep single-posting analysis are different products.
- **Analysis results live in Redis for 24h and are not persisted.** The user must explicitly confirm to save them.
- **The technology vocabulary is fixed and finite.** `technology-extractor.helper.ts` holds 35 entries with their regex aliases — the complete universe of what `tecnologias` can ever contain. Any UI affordance that implies open-ended skill discovery would overstate the backend.
- **Access token lives 60 minutes.** No refresh tokens, no logout endpoint.
- **Scraping cap:** 10s timeout, 6000 characters of extracted text.
- **The model call has a mock fallback.** When SGLang is unreachable, the API silently returns a fixed mock. The UI cannot distinguish real output from mock output.
- **No rate limiting** on auth or the analysis endpoint.

Terminology (confirmed, used as product language): *postulación*, *oferta*, *análisis*, *tecnologías*, *responsabilidades*, *años de experiencia*, *postulado* (the API's own title, "Postulado API"). For the MVP's aggregate, the natural product nouns are *cobertura* (the share of offers a skill covers) and *plan de aprendizaje* (the ordered recommendation).

Explicitly undecided: deploy target; whether the per-application letter/CV/pipeline stage stays in the product at all after the MVP validates.

## Brand Commitments

- Name: **PostulaDo** (the API's Swagger title reads "Postulado API" — an inconsistency to resolve, not a second brand).
- Language: Spanish, throughout.
- License: MIT. Repository owner: `amarillaRodrigo`.
- No logo, no color system, no typography, no iconography, no voice guide, and no prior visual identity exist. There is **no established visual world to inherit or extend** — this is a new visual world.
- **The prism (confirmed by the user, 2026-11-07):** the product's accent is not a colour but a **dispersion**. The hero is a lens; a batch of postings enters as white light and leaves split into the themes that cover it. The spectrum is the only multicolour element in the page, and it carries the mechanism rather than decorating it. Any future surface inherits the lens, the dispersion and the spectrum — not a flat brand colour.
- **Chromatic discipline (user feedback, 2026-11-07):** the beam must read as **light, not paint** — white with chromatic edges, never a saturated rainbow ribbon. Chromatic energy is rationed to the **call to action and the coverage data** (the percentage bars, the prism rays, the theme markers); everything else stays paper, ink and grey. One chromatic system at a time: a flat brand accent and the spectrum do not both carry the page.
- No customer names, testimonials, press, pricing, benchmarks, or performance claims exist. None may be invented.

## Evidence on Hand

- **The working API** and its e2e suite (`test/*.e2e-spec.ts`) are the authoritative source of behavior. `analisis-aprendizaje` has passing e2e coverage with exact response shapes and percentages.
- `docs/openapi.json` is a generated, current OpenAPI 3 document.
- **Synthetic demo material exists in code**: `JobAnalyzerService.getMockResult()` returns a realistic-shaped result (React, NestJS, Docker, PostgreSQL, 3 years, company tone, three document bodies). Usable as authored illustrative material, and it must be labeled as synthetic wherever it could be mistaken for real output.
- `technology-extractor.helper.ts` holds the 35-entry technology vocabulary and its regex aliases — the source of truth for what "tecnologías" can ever contain, and the natural source of the demo corpus.
- Absences that must not be fabricated: no logos, no photographs, no product screenshots, no user testimonials, no customer logos, no pricing, no usage statistics, no hiring-market statistics, no benchmark figures.

## Product Principles

1. **One question, one answer.** The product answers "what should I learn". Everything that does not serve that answer is out of scope until the MVP proves itself.
2. **Counts are the product.** A percentage traceable to real postings is the deliverable. A prose summary of it is decoration.
3. **Say the denominator.** Any coverage figure is meaningless without the corpus it was computed over — the interface must always show "N ofertas analizadas" beside the percentages.
4. **Never hide the wait.** Ingestion is slow and asynchronous. The UI must narrate progress honestly.
5. **The user's own corpus, not a generic market.** The ranking describes the postings this person is applying to.
6. **Say what is real.** The mock fallback exists; the UI must not dress a fallback up as an analysis.

## Accessibility & Inclusion

Known product-specific requirement, established from the operating context: the audience is a professional in an anxious, time-pressured situation, often reading on a phone between other tasks. The corpus summary must remain legible and operable at phone widths, and the ranked list must be readable without relying on color alone to distinguish covered from uncovered.
