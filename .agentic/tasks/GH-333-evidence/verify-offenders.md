# verify-offenders: mobile result, offender attribution, counts

Head measured: 49ee1f03 (code and offender files identical to b30cf4f5, which only adds notes).

## 1. Mobile result
`npx vite build`, then `npx playwright test --project=mobile --workers=3 --timeout=1800000`:
**34 passed (13.0 m)**, including every `phone standard at <size>, <theme>` cell. That test fails on any
unlisted failing cell (new target) and on any listed cell that now passes (`fixedButListed`), so the lists in
`web/src/mobile-standard/offenders/*.json` agree exactly with the cells on this head. The Tech Lead's full
`npm --prefix web run e2e` on b30cf4f5 agrees, and `web/e2e/analysis.spec.ts` passes (2 passed).

## 2. N of 18 removed, M remaining
The base had 18 `Analisis` `figure-split` entries (`base-mobile-targets.json`, `base-attribution.md`).
**11 of 18 removed, 7 remaining on rows this task leaves alone** (2 by-variety rows #48, 5
ExpenseBreakdownView subtotals #48).

Removed in 49ee1f03 (each was a node of the hero, strip or history block, all rebuilt): base entries 3 and 4
(`$ #.#.#.#[3]`, `[4]`: ExpenseBreakdownView nodes that renumber to `[1]`, `[2]` once the hero and history
nodes stop failing), 9 (`Own use $ #.# and # g without cost`), 10 (`Stock shortfall $ #.#`), 11 and 12
(`Promotion $ #.#[1]`, `[2]`), 13 (`expenses $ #.#.#.#`), 55, 56 (`Stock shortfall $ #.#[1]`, `[2]`),
57, 58 (`Own use ... [1]`, `[2]`). That is 11. (The hero entry 1 and the history `$ #.#.#.#[2]` entry 2 keep
their keys, see below, so they are not removals.)

The 7 remaining (sizes as listed in the file), with the node each comes from, taken from
`base-attribution.md` (base DOM, node by node) and still failing on this head (the passing mobile run proves
each listed cell still fails; the after capture shows the splits):

| entry | node | region |
|---|---|---|
| `span:$ #.#` (320, 375, 430) | `gastos__categoria-subtotal` (base doc order 470) | ExpenseBreakdownView |
| `span:$ #.#.#.#[1]` (all) | `gastos__categoria-subtotal` (460) | ExpenseBreakdownView (at base it was the hero; the hero now passes) |
| `span:$ #.#.#.#[2]` (all) | `gastos__categoria-subtotal` (475) | ExpenseBreakdownView (at base the history block's, or the 460 node, at 375/430) |
| `span:$ #.#.#[1]` (all) | `analisis__variedad-ventas` (78) | by-variety row |
| `span:$ #.#.#[2]` (all) | `gastos__categoria-subtotal` (485) | ExpenseBreakdownView |
| `span:$ #.#[1]` (246x437) | `analisis__variedad-ventas` (88) | by-variety row |
| `span:$ #.#[2]` (246x437) | `gastos__categoria-subtotal` (470) | ExpenseBreakdownView |

None comes from the strip, the week and month cost rows or the history block. The "Flower purchases" and
"Expenses since the first record" amounts visibly wrap `$` from its figure in
`.agentic/runs/GH-333/after/AnalisisCompu.png` (ignored by git), the by-variety/ExpenseBreakdownView
failure the PM kept out of scope (round 2).

## 3. Moved targets (old key to new key)
**None to swap.** The shifts `base-attribution.md` predicted are `$ #.#.#.#[3]` to `[1]` and `[4]` to `[2]` on
ExpenseBreakdownView nodes. Keys `[1]` and `[2]` were already listed (entries 1 and 2, all four sizes), so the
shifted nodes land on existing entries and no entry is added. The only offender-file change is the 103 deleted
lines in 49ee1f03; no entry was added, so no renumbered-target swap (gate.md:132) was needed.
`docs/product/gate.md:132` ("A renumbered target") is present on the branch.

## 4. h-scroll decision
The `Analisis` `h-scroll` entry (page rule, no target, no sizes: all four) **stays**. It is still listed and
the mobile run passed, so its cell still fails. Its base cause (`base-attribution.md`) is the by-variety
(`variedad-nombre`/`variedad-ventas`) and ExpenseBreakdownView (`categoria-nombre`/`-subtotal`) elements
running past the viewport, which are left alone. This head's after capture shows both blocks unchanged.

## 5. compare.sh offender counts (`scripts/design/compare.sh`, mobile-offenders.mjs)
| | base (`base-compare-counts.txt`) | after (this head) |
|---|---|---|
| known offenders, cells | 11042 | 11000 |
| #48 | 1300 | 1258 |
| figure-split | 266 | 224 |
| h-scroll | 184 | 184 |
| every other rule and issue | unchanged | unchanged |

Down by 42 cells, all `figure-split` on `Analisis` under #48.

## 6. Captures
`scripts/design/compare.sh --only Analisis,AnalisisOscuro,AnalisisCompu,AnalisisCompuOscuro` ran clean (all
four `ok`). The after PNGs are in `.agentic/runs/GH-333/after/` (not committed, to be attached to the PR by
hand). In the Analisis and AnalisisCompu comparisons the strip withdrawal lines, the week and month cost rows
and the history block read one labelled row per metric with every amount whole.
