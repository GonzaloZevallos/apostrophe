# GH-272 Home evidence (GH-295)

Review evidence only; judged by eye; valid only for the SHA below. No capture step is part of the Gate. Images are attached to the PR, never committed.

## Evidence head

- Evidence head: `882d646f489cfe9293520e42354f73d19acc88d8`. It holds the fix to Home's figure cards (`1df627c2`, `app.css`), the registry rows and their pins (`1f9ef5b8`) and the type fix of the test that the build refused (`882d646f`); only this file and its siblings in `docs/evidence/GH-272-home-evidence/` follow it.
- #272: merge `2908b7a9`, first parent `5091951f`.
- `@fontsource/plus-jakarta-sans`: 5.3.0, one install, shared by both sides.
- Argentina day 2026-10-23, one machine. "After" is the head, whole registry, `scripts/design/compare.sh --strict`, no `--only`: **exit 0, 173 rows, every one ok** (`strict-after-console.txt`). The baseline whole-registry run on the head before the fix (`38f604e3`, 170 rows) also exited 0, so nothing in the registry was red and nothing is left untouched on that account.
- "Before" is the head's tree (`git archive`, never committed, no git worktree was available) with #272's three product files undone, the head's own `scripts/design/` and registry, `--strict --only` the seven named screens: exit 0, all ok (`strict-before-console.txt`). Fresh sample each side.

## The undo

`docs/evidence/GH-272-home-evidence/undo.diff` (head to before, the three product files, plus #272's new `PeriodFigures.test.tsx` removed so that nothing imports a deleted module). Made as `git diff 2908b7a9 5091951f` of the three files, applied as a 3-way merge (`git merge-file`, base `2908b7a9`, other `5091951f`) because `git apply -3` could not run in a plain tree. `app.css` merged clean. `InicioPanel.tsx` conflicted on the imports and on the English copy: 43 later commits moved Home's words into `copy/` keys, and #272's undone inline nodes carried the old Spanish literals.

**Extra difference for the PM (not #272's change):** to keep the later translation, the undone inline nodes use the same `copy/` keys the head's `PeriodFigures.tsx` uses for the same strings (`INICIO_TEXT.vendisteHoy/EstaSemana/EsteMes`, `n0Promedio12`, `regalaste`, `pendingCostNote`, `COMMON_TEXT.expenses/flowerPurchases/profit/cash`, `SHORTFALL_LABEL`, `PROMOTION_LABEL`, `OWN_USE_LABEL`, `COST_OF_GOODS_LABEL`). Without it "before" would show Spanish words that the head does not, and every Home screen would differ by text, not by #272. Nothing else was undone.

`git apply --stat undo.diff` (head to before; the paths are the diff's own):

```
 InicioPanel.tsx          |  92 ++++++++++
 PeriodFigures.tsx        | 184 ----------------
 PeriodFigures.test.tsx   | 152 -----------------
 app.css                  | 149 ----------------
 4 files changed, 89 insertions(+), 488 deletions(-)
```

`PeriodFigures.test.tsx` is #272's test, not a product file; it goes with `PeriodFigures.tsx` so nothing imports a deleted module.

## ae.mjs, before to after (`ae.txt`)

The raw lines in `ae.txt` read `<screen> built` and `<screen> design`; each is before→after, built or before→after, design, as the table labels it.

| Screen and side | Line | Verdict |
| --- | --- | --- |
| Inicio, before to after, built | AE 0 | exact |
| Inicio, before to after, design | AE 0 | exact |
| InicioOscuro, built / design | AE 0 / AE 0 | exact |
| InicioHoy, built / design | AE 0 / AE 0 | exact |
| InicioHoyCompu, built / design | AE 0 / AE 0 | exact |
| InicioHoyCompuOscuro, built / design | AE 0 / AE 0 | exact |
| InicioCompu, before to after, design | AE 0 | exact |
| InicioCompuOscuro, before to after, design | AE 0 | exact |
| InicioCompu, before to after, built | FAIL different dimensions (2560x2460 before, 2560x1840 after) | intended by #272: Semana's and Mes's ten figures stop being stacked list rows and become a grid of cards beside the headline, as the drawing lays them out; the page is 310 CSS px shorter |
| InicioCompuOscuro, before to after, built | FAIL different dimensions (same sizes) | same, in the dark tokens (same structure) |

The five screens show exact AE 0 on both sides. Both InicioCompu lines are accounted for. The Compu 100 % comparison sheets (design column against built column) were judged by eye: the built page has the grid of cards (three per row at 1280 px) beside the headline at the drawing's place, the same cards, order and pending notes; differences left are the ones in the existing Home evidence (English copy, the sidebar's brand, dates and figures of the sample).

## By eye, light theme, computer layout

Images (not committed; the PR attaches them) are the built captures `<row>.built.png` of the after run.

| Set | Rows | Verdict |
| --- | --- | --- |
| 960 px | InicioHoyCompu960, InicioCompu960, InicioMesCompu960 | Today, Week, Month: two-column card grid, nothing clipped, overlapped, cut mid-word or unreachable; every figure, tab and Collect button readable |
| 1280 px | InicioMesCompu (Week at 100 % is InicioCompu) | Month: three-column grid beside the headline, all figures whole in their cards |
| 960 px, text at 130 % | InicioHoyCompu960Texto130, InicioCompu960Texto130, InicioMesCompu960Texto130 | After the fix: the grid is one column of whole cards (long page, nothing clipped or overlapping), every figure inside its card |
| 1280 px, text at 130 % (confirmation, requirement 6) | InicioHoyCompuTexto130, InicioCompuTexto130, InicioMesCompuTexto130 | Month and Week: two-column grid, figures inside their cards; Today as the 960 px one at 130 % |

"130 %" is the registry's text-only scale (`textScale.mjs`): the CSS viewport keeps its width, so the computer layout is the one captured.
