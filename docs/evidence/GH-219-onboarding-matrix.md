# GH-219: before/after capture of the Onboarding evidence matrix

Review evidence only: nothing here is a gate, CI or `.agentic/stack.yaml` step (ADR-0042).

- Base SHA: `fcfbd0aa09acaa2b44cddfe319332f86af913fc9` (exported with `git archive` to a scratch directory; the system forbids `git worktree`).
- Head SHA: `39130bb0e25f8a905d78d9297faf1fbacbe19872`.
- `@fontsource/plus-jakarta-sans`: 5.3.0, one install (head's `web/node_modules`, linked into the base copy).
- Overlay: head's whole `scripts/design/` over the base copy; diff stat against the base index equals `git diff --stat fcfbd0a..HEAD -- scripts/design` and no other file differs:

```
 scripts/design/comparisons.mjs |  9 ++++-----
 scripts/design/sample_app.py   |  2 +-
 scripts/design/screens.d.mts   |  4 ++++
 scripts/design/screens.json    | 13 ++++++++++---
 scripts/design/screens.mjs     | 39 +++++++++++++++++++++++++++++++++++++++
 5 files changed, 58 insertions(+), 9 deletions(-)
```

- Captures: `scripts/design/compare.sh --strict` over the whole registry (136 rows, file order, no `--only`), each side on a fresh sample, the same Argentina day (2026-10-16).
- The pressed "Stock inicial" pill of `EntradaStockSinEntrada*` is proven by `web/src/screens/EntradaStock.test.tsx:455-472`.
- Edited tests: `StockEntryForm.test.tsx` (line-75 assertion, present to absent), `EntradaStock.test.tsx`, `web/src/design/screens.test.ts`, `web/src/routes.test.ts` (the declared seams; by `origin-chip` and `matrix-rows`).

## Strict runs

Both runs captured all 136 rows and wrote every PNG, but both exit 1, for the same three rows outside the matrix:

- `EstadosConfirmar`: step `click "Borrar venta"` not reached in 8 s.
- `EstadosSinConexionCompu`, `EstadosSinConexionCompuOscuro`: a page font in error.

133 rows are `ok` on each side. The three also fail alone with `--only`, and GH-150's evidence recorded them failing on both sides. Pre-existing: filed as #254. All 35 matrix rows are `ok` on both sides, so no matrix cell is missing.

## ae.mjs over the 35 matrix rows

```
OnboardingStock built: AE 163559
OnboardingStockOscuro built: AE 163479
OnboardingStockCompu built: AE 178919
OnboardingStockCompuOscuro built: AE 178839
(every other line, 66 of 70, is AE 0; the full output has one line per row and side)
```

## Difference table

| Cells | Side | AE | Class |
|---|---|---|---|
| Every matrix row | design | 0 | capture is stable |
| OnboardingStock, OnboardingStockOscuro, OnboardingStockCompu, OnboardingStockCompuOscuro | built | 163559, 163479, 178919, 178839 | intended (onboarding.md step 2: no Origen label; the chip moves up and the form is shorter) |
| Those four cells | design | 0 | known design defect: `Onboarding*.dc.html` labels the chip "Origen" (not corrected here) |
| EntradaStockSinEntradas, ...Oscuro, ...Compu, ...CompuOscuro | built | 0 | the full form is unchanged (its `<legend>Origen</legend>` is drawn) |
| Every other Onboarding step, Listo, InicioPrimeraVez, ...Oscuro, ...Compu | built | 0 | no difference |

No regression found; no other difference. The only pre-existing difference found is the three strict failures, #254.
