# GH-219: before/after capture of the Onboarding evidence matrix

Review evidence only: nothing here is a gate, CI or `.agentic/stack.yaml` step (ADR-0042).

- Base SHA: `fcfbd0aa09acaa2b44cddfe319332f86af913fc9` (exported with `git archive` to a scratch directory; the system forbids `git worktree`). The plan names `f81f78b` as the task base; `git diff --stat f81f78b fcfbd0a` touches only `docs/product/onboarding.md` (1 file changed, 41 deletions), so the app, `web/` and `scripts/design/` are the same at both.
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

- Captures: `scripts/design/compare.sh --strict` (a wrapper of `comparisons.mjs --strict`) over the whole registry (136 rows, file order, no `--only`), each side on a fresh sample, the same Argentina day (2026-10-16).
- The pressed "Stock inicial" pill of `EntradaStockSinEntradas*` is proven by `web/src/screens/EntradaStock.test.tsx:455-464`.
- Edited tests: `StockEntryForm.test.tsx` (line-75 assertion, present to absent), `EntradaStock.test.tsx`, `web/src/design/screens.test.ts`, `web/src/routes.test.ts` (the declared seams; by `origin-chip` and `matrix-rows`).

## Strict runs

Both runs captured all 136 rows and wrote every PNG, but both exit 1, for the same three rows outside the matrix:

- `EstadosConfirmar`: step `click "Borrar venta"` not reached in 8 s.
- `EstadosSinConexionCompu`, `EstadosSinConexionCompuOscuro`: a page font in error.

133 rows are `ok` on each side. The three also fail alone with `--only`, and GH-150's evidence recorded them failing on both sides. Pre-existing: filed as #254. All 35 matrix rows are `ok` on both sides, so no matrix cell is missing.

## ae.mjs over the 35 matrix rows

The complete, unfiltered output is `docs/evidence/GH-219/ae-full.txt`: 70 lines, one per cell and side, AE 0 lines included. Its `--only` list is `docs/evidence/GH-219/matrix-only-list.txt`: exactly the 35 matrix cells. The four non-zero lines:

```
OnboardingStock built: AE 163559
OnboardingStockOscuro built: AE 163479
OnboardingStockCompu built: AE 178919
OnboardingStockCompuOscuro built: AE 178839
```

The other 66 lines are AE 0. `ae.mjs` compares the raw `<Name>.design.png` and `<Name>.built.png` of each side; the attached sheets are the composed `<Name>.png` (design next to built).

## Attached sheets

`docs/evidence/GH-219/before/` and `docs/evidence/GH-219/after/` each hold the composed sheet `<Name>.png` of all 35 matrix cells (Onboarding steps 1 to 6 and Listo in phone, Oscuro, Compu and CompuOscuro; InicioPrimeraVez, InicioPrimeraVezOscuro, InicioPrimeraVezCompu; the four EntradaStockSinEntradas* rows), plus that run's `index.json` (its `notes` lists any step that failed; the paths inside it are the scratch directories of the run). The `--strict` exit codes (1 on both sides, for the three rows above) are stated in "Strict runs"; the run's own console output was not kept beyond what `index.json` records.

## Difference table

| Cells | Side | AE | Class |
|---|---|---|---|
| Every matrix row | design | 0 | capture is stable |
| OnboardingStock, OnboardingStockOscuro, OnboardingStockCompu, OnboardingStockCompuOscuro | built | 163559, 163479, 178919, 178839 | intended (onboarding.md step 2: no Origen label; the chip moves up and the form is shorter) |
| Those four cells | design | 0 | known design defect: `Onboarding*.dc.html` labels the chip "Origen" (not corrected here). Design-side AE 0 means the design capture is the same before and after; it does not mean the drawing matches the build, which it no longer does on this label. |
| EntradaStockSinEntradas, ...Oscuro, ...Compu, ...CompuOscuro | built | 0 | the full form is unchanged (its `<legend>Origen</legend>` is drawn) |
| Every other Onboarding step, Listo, InicioPrimeraVez, ...Oscuro, ...Compu | built | 0 | no difference |

No regression found; no other difference. The only pre-existing difference found is the three strict failures, #254.

## Notes added at integration

- Captured code: head `39130bb`. The later commits on the branch change only `docs/evidence`, so the captured code is the branch head's.
- `web/src/routes.test.ts` gains six names in `REACHED_BY_STEPS` (the four `EntradaStockSinEntradas*` rows, `OnboardingVariedadCompuOscuro`, `OnboardingListoCompuOscuro`). Without them its "route is path for every screen" check fails on those six rows. It is the registry seam the plan declares, though plan invariant 3 does not list it.
