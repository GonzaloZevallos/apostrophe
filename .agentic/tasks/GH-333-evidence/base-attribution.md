# Base attribution of the 18 `Analisis` figure-split entries and the h-scroll entry

Read from the base DOM, node by node. A throwaway Playwright spec (not committed) ran, at the four
sizes (246x437, 320x568, 375x812, 430x932), the geometry collector copied verbatim from
`web/e2e/mobile/collectGeometry.ts` plus, for each failing node, its element chain, its text and its
document order. At every size the figure-split and h-scroll set it found equals the listed offenders
exactly. The raw nodes are in `base-dom-nodes.json` (`region`, `domOrder` = index in document order
among all elements, `chain`, `text`; `overflowingElements` for the h-scroll).

Regions: **hero** (`span.cifra-xl`), **strip** (`span.pie` withdrawal `CostLine`s under the hero, in an
unnamed `div` in `div.cuerpo`), **history** (the "since your first record" block), **by-variety**
(`analisis__variedad-*`, left alone), **ExpenseBreakdownView** (`gastos__categoria-subtotal`, left
alone). No week/month card, table or cost-row node fails in the sample at any size. Entries with no
`sizes` apply to all four.

## The 18 figure-split entries

| # | target | sizes | region (document order) |
|---|---|---|---|
| 0 | `span:$ #.#` | 320, 375, 430 | ExpenseBreakdownView `categoria-subtotal` (470); left alone |
| 1 | `span:$ #.#.#.#[1]` | all | hero `cifra-xl` (65), all four sizes; in scope |
| 2 | `span:$ #.#.#.#[2]` | all | 246, 320: history block (449); 375, 430: ExpenseBreakdownView (460, left alone) |
| 3 | `span:$ #.#.#.#[3]` | all | 246, 320: ExpenseBreakdownView (460); 375, 430: ExpenseBreakdownView (475); left alone |
| 4 | `span:$ #.#.#.#[4]` | 320, 246 | ExpenseBreakdownView (475); left alone |
| 5 | `span:$ #.#.#[1]` | all | by-variety `variedad-ventas` (78); left alone |
| 6 | `span:$ #.#.#[2]` | all | ExpenseBreakdownView (485); left alone |
| 7 | `span:$ #.#[1]` | 246 | by-variety `variedad-ventas` (88); left alone |
| 8 | `span:$ #.#[2]` | 246 | ExpenseBreakdownView (470); left alone |
| 9 | `span:Own use $ #.# and # g without cost` | 246 | strip `CostLine` (69); in scope |
| 10 | `span:Stock shortfall $ #.#` | 320 | strip `CostLine` (67); in scope |
| 11 | `span:Promotion $ #.#[1]` | 320, 246 | strip `CostLine` (68); in scope |
| 12 | `span:Promotion $ #.#[2]` | 320, 246 | history block (454); in scope |
| 13 | `span:expenses $ #.#.#.#` | 320, 375, 430 | history block (450); in scope (it is the history block's own "expenses" span, not a week/month card) |
| 55 | `span:Stock shortfall $ #.#[1]` | 375, 246 | strip `CostLine` (67); in scope |
| 56 | `span:Stock shortfall $ #.#[2]` | 375, 246 | history block (453); in scope |
| 57 | `span:Own use $ #.# and # g without cost[1]` | 375 | strip `CostLine` (69); in scope |
| 58 | `span:Own use $ #.# and # g without cost[2]` | 375 | history block (455); in scope |

Entry 0 is the ExpenseBreakdownView subtotal, not the hero: the hero's text is `$ #.#.#.#` (entry 1).
Entries 2 differs by size as shown; this is the only entry with two regions.

## The h-scroll entry

`h-scroll` `Analisis` (page rule, no target): the document is 569 px wide at every size. The elements
past the viewport (`overflowingElements`) include, at all four sizes, `analisis__variedad-nombre` /
`analisis__variedad-ventas` (right 453 / 567) and `gastos__categoria-nombre` / `gastos__categoria-subtotal`
(right 439 / 569), all in left-alone regions. At 246 and 320 the hero `span.cifra-xl` (right 369) and at
246, 320 and 375 the strip `span.pie` (right 409) overflow too. Region: whole page, with left-alone
causes; so it does not clear once the hero, strip and history are fixed and the entry stays.

## Item 6: keys of left-alone entries after the in-scope nodes are fixed

A left-alone node's ordinal counts the failing nodes with the same masked target before it in document
order. Only `$ #.#.#.#` is shared between an in-scope node (hero 65, history 449 at 246/320) and
left-alone nodes (ExpenseBreakdownView 460, 475). No other left-alone entry has an in-scope node with its
masked text before it: `$ #.#.#`, `$ #.#` (the by-variety and ExpenseBreakdownView nodes) and `$ #.#.#.#`
are the only amount-first texts; the labelled `CostLine` and `expenses $` texts have no left-alone node.

| size | node (document order) | key at base | key after the fix |
|---|---|---|---|
| 246, 320 | ExpenseBreakdownView subtotal (460) | `$ #.#.#.#[3]` | `$ #.#.#.#[1]` |
| 246, 320 | ExpenseBreakdownView subtotal (475) | `$ #.#.#.#[4]` | `$ #.#.#.#[2]` |
| 375, 430 | ExpenseBreakdownView subtotal (460) | `$ #.#.#.#[2]` | `$ #.#.#.#[1]` |
| 375, 430 | ExpenseBreakdownView subtotal (475) | `$ #.#.#.#[3]` | `$ #.#.#.#[2]` |
| all | by-variety (78), `$ #.#.#[1]`; ExpenseBreakdownView (485), `$ #.#.#[2]`; `$ #.#` (470; 246: `[2]`, by-variety 88 `[1]`) | unchanged | unchanged |

Consequence for the offender file: after the fix the keys `$ #.#.#.#[1]` and `[2]` are still failing
nodes at all four sizes (the ExpenseBreakdownView ones), so entries 1 and 2 stay as they are and need no
added entry; entries 3 and 4 have no node left and are deleted. No renumbered target has to be added.
This holds only if the hero and history nodes pass (no failing `$ #.#.#.#` before the ExpenseBreakdownView
ones); a hero or history node that still fails keeps its ordinal and shifts nothing.
