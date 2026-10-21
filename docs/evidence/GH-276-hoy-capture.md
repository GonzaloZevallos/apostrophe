# GH-276: InicioHoyCompu names its Hoy section (ADR-0042 evidence)

Base `16023685cade4a6a6332e7899e225f13dcd6f38a`, head `bf373f48b7473b19b27b2825cb43a0d1d0c76db1`.
`@fontsource/plus-jakarta-sans` 5.3.0, one install (the head's `web/node_modules`, linked into the base copy).
Overlay diff stat, equal to `git diff --stat 16023685..bf373f48 -- scripts/design`:
`scripts/design/screens.json | 4 ++--` (1 file changed, 2 insertions, 2 deletions).
`comparisons.mjs`, `screens.mjs` and `sample_app.py` are identical on both sides, so each side ran from its own checkout.

## Status: whole-registry runs pending

The GH-219 whole-registry before/after (`compare.sh --strict`, 157 rows, file order, no `--only`, base from its own
checkout, head from this one) was started at 2026-10-21T19:46-03:00 as a background command and had not finished when this
note was committed. The section below is the four-screen `--only` run of the earlier pass; it is to be replaced by the
whole-registry result, not kept beside it (ADR-0042: the two methods are not mixed in one note).

## Method, and what is missing

Both sides ran `scripts/design/compare.sh --strict --only InicioHoyCompu,InicioHoyCompuOscuro,InicioCompu,InicioCompuOscuro`,
each on a fresh sample, the same Argentina day; both exited 0 and all four rows reported `ok`.
This is the `--only` method of GH-224's evidence, safe because `assertSelectedNeeds` guards the selection; it is not the
whole-registry method of the GH-219 amendment. A whole-registry before-run (157 rows) was started and cut off by the
10-minute tool limit after 94 rows, so no whole-registry run exists for either side. It has to be taken where a run of
about 16 minutes fits.

## ae.mjs over the raw captures (before dir, after dir)

| screen | side | result |
|---|---|---|
| InicioCompu | built | AE 0 |
| InicioCompu | design | AE 0 |
| InicioHoyCompu | built | AE 0 |
| InicioHoyCompu | design | different dimensions: 2560x3928 before, 2464x1888 after (intended: the whole drawing became the Hoy frame) |
| InicioHoyCompuOscuro | built | AE 0 |
| InicioHoyCompuOscuro | design | different dimensions: 2560x3928 before, 2464x1888 after (intended, same crop) |
| InicioCompuOscuro | built | AE 0 |
| InicioCompuOscuro | design | AE 0 |

The caption edit does not change the design side of `InicioCompu` or `InicioCompuOscuro` (both Semana crops, AE 0).

## By-eye judgement

`InicioHoyCompu` after: the design side is the Hoy frame only (no Semana, Hoy tab active, caption
"Hoy · la pestaña con la que abre el panel"); the built side shows Hoy with the same structure.

## Audit of the other `Inicio*` rows

`Inicio` (Semana section, clicks Semana), `InicioHoy` (Hoy section), `InicioOscuro` (single-frame drawing),
`InicioCompu` and `InicioCompuOscuro` (Semana section, click Semana): correct. `InicioPrimeraVez`,
`InicioPrimeraVezCompu`, `InicioPrimeraVezOscuro`: no section against a multi-frame drawing; the fix needs seeded
first-run accounts and one row per frame, so it is follow-up issue #303.
