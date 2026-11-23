---
status: draft
---
## Goal

Give New sale's Product list (`web/src/screens/ventas/NuevaVentaProductos.tsx`) its loading and failure states. A seller on the phone then never sees a wrong, old or empty price while prices load or after a read fails. The work serves the brief's first job: a sale recorded from the phone in under a minute, with the total worked out from that day's prices. The list stays unrouted until the flip part of GH-496.

## Acceptance criteria

- Before every read has settled, the suggestions read included, the list shows `MOST_SOLD_ROWS` skeleton rows with `aria-busy` true via `LoadingWhile`.
- During the first load the list shows no header, no digit, no currency symbol of the Business's Money format, no hint and no empty-list wording.
- With the products read resolved and the suggestions read still pending, the skeleton is still shown.
- On a date or Customer change on a loaded list, the names and steppers of lines stay.
- On a date or Customer change on a loaded list, the date-dependent cells show the compact loading mark, the list is `aria-busy` and the hint is hidden.
- A Customer change re-prices with no flash of the old figure while the new one is pending.
- A `NetworkError` on the products read shows SinConexion, and any other error shows ErrorGenerico.
- Either failure state replaces the whole list with no `aria-busy`, and nothing from the old list shows.
- A date or Customer change after a failure shows the skeleton rows again.
- After a failure, a successful read shows the lines with the quantities entered and the new prices.
- No loading or failure state clears or changes the Sale in progress.
- A 500 on the suggestions read shows no error, no marker and no empty suggestions heading, and the list works without suggestions.
- No new copy keys, no route, no navigation entry and no screen mounting the list are added.
- vitest, tsc strict and oxlint pass with nothing silenced, and all of #924's ten invariants hold.

## Out of scope

- Routing, navigation or mounting the list (the flip part of GH-496).
- New retry behaviour beyond what SinConexion and ErrorGenerico already offer.
- Saving or recovering a Sale in progress.
- Changing SinConexion or ErrorGenerico.
- Assessing how the live New sale behaves today.

## Decisions

- The first-load skeleton stays until the suggestions read settles too, whether it succeeds or fails.
  - Reason: the request's test says "before all reads", and rows must not reflow under the seller's thumb when suggestions arrive.
- After a failure, any new read shows the skeleton rows, not the compact loading marks.
  - Reason: a failure leaves no loaded lines to keep, so the first-load rules apply again.
- A failure after a successful load replaces the whole list, and nothing from the old list shows.
  - Reason: the old prices belong to a date or Customer that no longer applies, and showing them would present an old price as current.
- Suggestions have no loading marker, no failure marker and no empty heading.
  - Reason: suggestions only shorten choices and must never block or distract from a sale.
- Loading and failure states never clear or change the Sale in progress, and a successful later read restores the lines with their quantities.
  - Reason: the state changes only what the list shows, and the Sale in progress lives in New sale, not in the list.
- The test checks for the Business's Money format symbol rather than a hard-coded `$`.
  - Reason: Assume nothing, so no business's currency is hard-coded.

## Risks

Waiting for the suggestions read on the first load lengthens the skeleton when the suggestions read is slow.
If lines are not kept apart from the reads' state, a failure could drop the quantities the seller entered.

## Screens

The task touches the UI. Its screens come from the design stage.

## Slices

### loading-and-failure-states

#### Acceptance criteria

- `NuevaVentaProductos.tsx` implements the skeleton, compact-mark, SinConexion, ErrorGenerico and silent-suggestions-failure states, and leaves the Sale in progress untouched.
- `NuevaVentaProductos.test.tsx`, on #924's harness, covers loading, the first load waiting for suggestions, a Customer change with no flash, the hidden hint, a products 500, a network failure, a suggestions 500, no `aria-busy` on failure, the skeleton after a failure and recovery with entered quantities.
- vitest, tsc strict and oxlint pass with nothing silenced.

#### Risks

- slow-suggestions-lengthen-first-load
- lines-lost-on-failure