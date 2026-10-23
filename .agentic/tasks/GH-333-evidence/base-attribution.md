# Base attribution of the 18 `Analisis` figure-split entries and the h-scroll entry

Source: `web/src/mobile-standard/offenders/figure-split.json` and `h-scroll.json` on the base, whose
`mobile` run passed (34 passed, so each entry matches a real failing node; see
`base-mobile-targets.json`).

**Limit of this file.** The region of each entry is inferred from its masked target and from the
base markup in `web/src/screens/Analisis.tsx`; the live DOM was NOT read node by node. Entries whose
masked text matches more than one region are marked "ambiguous" and must be settled by the
`verify-offenders` subtask from its after-run diff (the same rule applies there: a shift not
predicted here is checked against the four renumbering conditions of `docs/product/gate.md`).

A target `span:<label> $ #.#` is a `CostLine` span (label and amount in one text node), which is in scope
whichever region it sits in: strip withdrawal lines (`className="pie"`, :269), week/month cost rows
(`RowCostLines`, :382/:446/:154) or history block (`WithdrawalLines`, :516).

| entry (sizes) | region | in scope |
|---|---|---|
| `span:$ #.#` (320, 375, 430) | hero amount, `cifra-xl` (:260); no ordinal, so the only node with this text | yes |
| `span:$ #.#.#.#[1]`, `[2]`, `[3]` (all sizes), `[4]` (320, 246) | ambiguous: amount-first spans with 4 digit runs; history-block bare spans (:509-515) and card/table figures both start with "$ " | ambiguous |
| `span:$ #.#.#[1]`, `[2]` (all sizes) | ambiguous: history sales span (:509) / expense-breakdown subtotals (`gastos__categoria-subtotal`, left alone) / by-variety amounts | ambiguous |
| `span:$ #.#[1]`, `[2]` (246) | ambiguous: bare amount spans at 246 (history block, by-variety header `analisis__variedad-ventas`) | ambiguous |
| `span:Own use $ #.# and # g without cost` (246) | `CostLine` (strip, :269) | yes |
| `span:Stock shortfall $ #.#` (320) | `CostLine`: strip (:269) | yes |
| `span:Promotion $ #.#[1]`, `[2]` (320, 246) | `CostLine`: strip (:269) and a week/month row or history block | yes |
| `span:expenses $ #.#.#.#` (320, 375, 430) | week/month card span `ANALYSIS_TEXT.gastos` (:384), left as it is (plan: coexisting shape) | NO, stays |
| `span:Stock shortfall $ #.#[1]`, `[2]` (375, 246) | `CostLine`: strip / week-month rows / history block | yes |
| `span:Own use $ #.# and # g without cost[1]`, `[2]` (375) | `CostLine`: strip / week-month rows / history block | yes |
| h-scroll `Analisis` (page rule, no target) | whole page overflows horizontally at some size; deleted only if its cell passes after step 2 | decided by the after-run |

By-variety rows (`analisis__variedad-*`, the table cells) carry no `CostLine`; any entry that falls
there is the PM's round-2 "remaining, out of scope (#48)". Any of them whose key shifts because an
in-scope node before it in document order is fixed is a renumbered target (gate.md, PM round 3);
the ordinal-bearing, ambiguous rows above are the candidates: `$ #.#.#.#`, `$ #.#.#`, `$ #.#`.
