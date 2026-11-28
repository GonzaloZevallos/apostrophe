---
status: draft
---
## Goal

This part wires the existing line detail into New sale for a seller building a sale on the phone. Tapping a line's name and price area opens `LineDetailSheet`. There the seller fixes the quantity, makes the line a Gift, gives it a Special price or removes it, without leaving New sale or losing the customer and the other lines. A line with no price shows "No price" with the shared Attention icon, never $0, and opens the same detail. It is GH-496 part 9c, narrowed out of #987. It is front only and not routed, and it serves the Brief's first job: a sale recorded from the phone in under a minute, with a total the seller trusts.

## Acceptance criteria

- In `NuevaVentaProductos`, a line whose `PricedSaleLine.pricing` is null shows `lineNoPrice` ("No price") with the shared Attention icon in the price slot, never $0, with "−" and the quantity and no "+".
- No component decides "no price" by testing `gift` or `specialPrice` on its own; only `pricing === null` decides it.
- A row not in the sale keeps `productNoPrice` with no icon.
- The name and price area of a line, in "In the sale" and in search results, is one button with the accessible name `lineOpenDetail(name)` that opens `LineDetailSheet` for that line, with no chevron, "Edit" or other visible mark.
- A "no longer available" line also opens the detail, named with the shared "no longer available" text.
- Tapping "−", the quantity or "+" never opens the detail.
- `NuevaVentaSheet` holds which line is open and mounts the detail stacked on itself. Opening or closing it does not change `touched`.
- Done with an edit sends `editLine` exactly once, closes the detail, and the row total updates. Done with an unchanged buffer closes without sending anything.
- Close and the back gesture on the detail go back one level to New sale with every line kept, and never show "Discard the sale?".
- Remove line sends `removeLine` and closes the detail. On the last line the draft has no lines, the sale bar has no Collect, and the customer, date, Shipping charged and Note are unchanged.
- `lineNoPrice` and `lineOpenDetail(name)` live in `web/src/copy/sales.ts`, in English with no Unit or product-type words. They are registered in LIMITED_COPY and BASELINE_ARGS, and their `en.baseline.json` entries are inserted in order with the text the script emits.
- No route, build constant, query parameter, window flag or `data-*` hook exists only for tests.
- Testing Library tests at fetch level cover:
  - the "No price" row opening the detail
  - a priced row opening it
  - "−", the quantity and "+" not opening it
  - Done sending `editLine` once
  - Remove line on the last line
  - closing the detail without "Discard the sale?"
- CI jobs web, vitest and ci-ok pass.

## Out of scope

- Collect and the other stacked Sheets.
- The date control and its refusal texts.
- The GH-496 routing flip, WalkState and `screens.json` entries, Design capture and Screen image.
- Any change to how lines are priced, and setting a Product's price from the detail.
- A chevron or "Edit" mark, a confirmation on Close or on Remove line, and a notice or Undo after Remove line.
- An `inert` block behind the detail and a dedicated Escape test.
- Any server change.

## Decisions

- Lines shown in search results open the detail too, not only lines in "In the sale".
  - Reason: a search result that is already in the sale is drawn with the same line shape, and `sale-in-progress.md` already puts the tap on both.
- The `inert` block behind the detail and a dedicated Escape test stay out of this part, as a known gap.
  - Reason: the request lists neither of them, and the Escape+Close race is already accepted in the capability as its own task.
- The baseline is taken as "rows with only −, quantity and +", without checking how sellers cope in the live form.
  - Reason: New sale is not routed, so no seller uses it, and another baseline would not change what this part builds.

## Risks

- The back gesture on the stacked detail could reach the Host's leave guard and ask "Discard the sale?". Tests must show that closing it goes back one level only.
- The look of the "No price" row and of the detail can't be compared with the drawings until the flip mounts the screen.

## Screens

The screens come from the design stage. The owner accepted the drawing departures on NuevaVentaProductos on 2026-11-25: the tap with no extra mark, and "No price" with the Attention icon instead of $0.

## Slices

### wire-line-detail-into-new-sale

#### Acceptance criteria

- A line with null `pricing` shows `lineNoPrice` with the Attention icon and never $0, with "−" and the quantity and no "+". Its `lineOpenDetail(name)` area opens the detail.
- A priced line's name and price area opens the detail. "−", the quantity and "+" never do. No visible mark is added.
- `NuevaVentaSheet` holds the open line. Done sends `editLine` once (none when unchanged). Remove line sends `removeLine`. Closing goes back one level without "Discard the sale?".
- Remove line on the last line leaves a clean draft with no Collect, and the customer, date, shipping and Note are unchanged.
- The copy keys are registered and their baseline entries inserted. There are no test-only hooks. web, vitest and ci-ok pass.

#### Risks

- back-gesture-reaches-leave-guard
- look-not-compared-until-flip