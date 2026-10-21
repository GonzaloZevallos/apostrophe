# GH-276: InicioHoyCompu names its Hoy section (ADR-0042 evidence)

Base `16023685cade4a6a6332e7899e225f13dcd6f38a`, head `bf373f48b7473b19b27b2825cb43a0d1d0c76db1`
(the later commits on the branch add only this note).
`@fontsource/plus-jakarta-sans` 5.3.0, one install: the head's `web/node_modules`, linked into the base copy.
Overlay diff stat, equal to `git diff --stat 16023685..bf373f48 -- scripts/design`:
`scripts/design/screens.json | 4 ++--` (1 file changed, 2 insertions, 2 deletions).
`comparisons.mjs`, `screens.mjs` and `sample_app.py` are identical on both sides, so each side ran from its own
checkout (the base from a `git archive` copy of its SHA, with head's `web/node_modules` and `.venv` linked in).

## Method (ADR-0042, GH-219 amendment)

Each side ran `scripts/design/compare.sh --strict` over the whole registry, in file order, with no `--only`, on a fresh
sample, on the same Argentina day (2026-10-21): before at 19:46 -03, after at 20:06 -03.

| side | rows | result |
|---|---|---|
| before (base 16023685) | 157 | every row `ok`, exit 0 |
| after (head) | 157 | every row `ok`, exit 0 |

## ae.mjs over the raw captures (before dir, after dir)

`node scripts/design/ae.mjs <before> <after>` printed 314 lines (157 rows, built and design side each).
312 are `AE 0`. The two that are not:

| screen | side | result |
|---|---|---|
| InicioHoyCompu | design | different dimensions: 2560x3928 before, 2464x1888 after (intended: the whole drawing became the Hoy frame) |
| InicioHoyCompuOscuro | design | different dimensions: 2560x3928 before, 2464x1888 after (intended, same crop) |

Both built sides are `AE 0`. The caption edit does not move the design side of `InicioCompu` or `InicioCompuOscuro`
(both Semana crops, `AE 0`), nor any other row drawn from `InicioCompu.dc.html`.

## By-eye judgement

`InicioHoyCompu` and `InicioHoyCompuOscuro` after: the design side is the Hoy frame only (no Semana, Hoy tab active,
caption "Hoy · la pestaña con la que abre el panel"); the built side shows Hoy with the same structure, in light and in
dark. The dark row compares a dark build against the light computer drawing, as the other `CompuOscuro` twins do.

## Audit of the other `Inicio*` rows

`Inicio` (Semana section, clicks Semana), `InicioHoy` (Hoy section), `InicioOscuro` (single-frame drawing),
`InicioCompu` and `InicioCompuOscuro` (Semana section, click Semana): correct. `InicioPrimeraVez`,
`InicioPrimeraVezCompu`, `InicioPrimeraVezOscuro`: no section against a multi-frame drawing; the fix needs seeded
first-run accounts and one row per frame, so it is follow-up issue #303.
