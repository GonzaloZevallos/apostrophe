---
status: draft
---
## Goal

In the unrouted New sale Collect Sheet, the seller types what the customer hands over (Received) and sees the change at once (Change), so they hand back the right amount without doing the sum in their head. The Sheet also always shows a Total row, so the sale total stays visible when the Collect button's label is shortened to "Collect" on a narrow phone. Received and Change are only a helper: the recorded payment is the chosen Payment method for the Sale total, exactly as before. No seller reaches this until the flip part of GH-496.

## Acceptance criteria

- The Collect Sheet always shows a "Total" row above "How they pay", with `priced.totals.total` in the Money format and in Tabular figures, at every width.
- At the narrow width where the button reads "Collect", the Total row shows the sale total.
- A money input labelled "Received", formatted with `useMoney()`, sits directly under "How they pay", with the help line "Type what they hand over to see the change. It isn't saved.". It is held in Sheet-local state, starts empty and is never prefilled.
- A "Change" line comes right after Received. Its figure comes only from `changeFor(received, priced.totals.total, format)`, in Tabular figures. It shows only when `changeFor` returns a value: 0 when Received equals the total, and the difference when it is over.
- An empty, short or invalid Received shows no Change, no warning and no error, and never blocks Collect.
- The Collect Sheet does no money parsing or arithmetic of its own.
- While the effective choice is owing (read through `effectiveChoice`), the Received field, its help line and Change are hidden. Nothing keys the helper to a method's name or a cash flag.
- What was typed in Received is kept across a method change, across owing and back, and after a failed save.
- Received and Change never appear in the `POST /api/sales` body, which is still built only by `saleBodyOf`.
- While a save is in flight, Received looks unchanged and is `inert` with the rest of the field block. "Saving…" stays the only signal.
- "Collect {total}" falls back to "Collect" when it doesn't fit, decided by a layout effect plus a ResizeObserver that compare `scrollWidth` with `clientWidth`. It never shrinks or wraps, and the accessible name keeps the full "Collect {total}".
- The copy keys for "Total", "Received", its help line and "Change", plus "Collect" if it doesn't exist yet, live in the sales copy module in `web/src/copy/`, in English, with no unit, currency or product-type word.
- `docs/product/sale-in-progress.md` notes that `sales.md` criterion 34 stays in force until the flip part.
- A second Testing Library test file at fetch covers every case above, Change at 0 and 2 decimals included, and the fallback via `Object.defineProperty`. vitest passes.

## Out of scope

- Any route, navigation entry, `screens.json` row, WalkState or host screen that mounts the Sheet (flip part of GH-496).
- The "Owes it" option itself (#944).
- Part payments at sale time, and saving, sending or showing Received or Change anywhere else.
- Preselecting a method and rewriting `sales.md` criterion 34.
- The host ignoring the system back and Escape while saving, a combined sale bar + Sheet total test, and showing response figures with the `linesRepriced` note after `onSaved` (all carried to the flip part).

## Decisions

- The helper shows for every Payment method and is hidden only on owing.
  - Reason: Assume nothing. Payment methods are a Growable set the seller names, and there is no cash flag.
- A Received below the total shows nothing, not even a "still owed" figure.
  - Reason: such a figure would suggest a part payment the Sheet cannot record.
- The Sheet always shows a Total row above the payment method.
  - Reason: Human Decision 1. Otherwise the total shows nowhere once the label falls back, and the approved drawing already draws the row.
- Received and Change stacked or side by side is a layout detail. On a narrow phone they stack.
  - Reason: the owner would not read or do anything differently either way.
- D-8ecb8c1d does not apply to the Collect label. It falls back to the text "Collect".
  - Reason: that rule covers a phone title row, and this is the Sheet's bottom primary action, which already has a shorter text form.
- Owing is detected only through `effectiveChoice`. If #944 is not on master, the tests reach owing through the draft.
  - Reason: the "Owes it" option arrives with #944, and the helper must not depend on an option label.

## Risks

- Money rounding: arithmetic done outside `changeFor` could drift at 2 decimals. Tests cover 0 and 2 decimals.
- NuevaVentaCobrar is not declared for this task, so comparisons with it are unverified, and the written definition wins.
- The added Total row and helper add height and could crowd a small phone. Check them at the narrow width (Phone first).

## Screens

The task touches the UI. The screens come from the design stage (NuevaVentaCobrar and its dark twin). The Sheet has no route or Screen image until the flip part of GH-496.

## Slices

### collect-sheet-change-helper

#### Acceptance criteria

- The Total row, Received with its help line, Change, and the "Collect" label fallback behave as the Spec's acceptance criteria state, in `web/src/screens/ventas/CollectSheet.tsx`.
- Received and Change never reach the POST body, and the Sheet does no money arithmetic.
- The copy keys are in `web/src/copy/`, and the `docs/product/sale-in-progress.md` note about criterion 34 is added.
- A second test file covers every case, and vitest passes.

#### Risks

- money-rounding
- small-phone-height
