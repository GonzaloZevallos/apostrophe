---
status: draft
---
## Goal

Build the Collect Sheet, the closing step of New sale. The seller sees the total they are about to collect, says how they were paid (or that the Customer owes it) and saves the sale in one tap with the right payment and the right debt. The Sheet is a component inside the shared Sheet, and it is not routed until the flip part of GH-496.

## Acceptance criteria

- `web/src/screens/ventas/CollectSheet.tsx` exists and renders inside `web/src/components/Sheet.tsx`, with the props `draft`, `priced`, `customerName`, `onClose`, `onSaved` and `onSavingChange`.
- No route, navigation entry, `scripts/design/screens.json` row, WalkState entry, flag, query parameter or data-* hook reaches the Sheet.
- The title reads "The sale · {n} items" with n = `priced.lines.length`, using a singular form for one line when the copy module supports plurals.
- A read-only Customer row shows `customerName`, or "No customer" when it is null.
- The "How they pay" Selector is fed by `usePaymentMethodOptions`, and its value comes only from `effectiveChoice`. A proposal that is not offered gives an empty field.
- "Owes it" is offered only when the draft has a customerId, and choosing it sets `{kind:'owing'}`. Going back from it to paying sets `{kind:'unset'}`, which shows the proposal.
- While the methods list is pending, Collect is disabled and keeps its label. When the list fails, the Selector shows its own failure and Collect is enabled.
- The Collect label is "Collect {total}" with `priced.totals.total` in the Money format, for every choice.
- With no method above $0, or with a method marked "no longer available", a tap makes 0 requests, shows "Choose how they pay to collect." with the Attention icon and focuses the field.
- A $0 sale with no method sends `payment: null`. A $0 sale with a chosen method sends that method.
- A valid tap shows "Saving…", calls `onSavingChange(true)` and sends exactly one `POST /api/sales`, built by `saleBodyOf`, with lines from the draft through `quantityOfHundredths`.
- While saving, extra taps and the Sheet's Close make no further request and keep the Sheet open.
- On success, `onSavingChange(false)` is called, then `onSaved` with the response unchanged.
- On failure, `onSavingChange(false)` is called, the method and lines are kept, a retry makes exactly one more request, and Close works again.
- A failure other than the method refusal or a 401 shows "The sale was not saved. Your lines are kept, so try again." with the Attention icon.
- The method refusal shows the Selector's "no longer available" mark and invalidates `keys.paymentMethods()`.
- The Sheet never calls `priceSale` or `priceLine`, and adds no Escape or popstate listener.
- Every new text is a key in the sales copy module in `web/src/copy/`, in English, with no unit, currency or product-type word.
- vitest passes.

## Out of scope

- Any host screen, and the flip part of GH-496 that mounts the Sheet.
- Received and Change.
- Any server change, including protection against recording a sale twice when the answer is lost.
- Rewriting sales.md criterion 34.
- Part payments at sale time (they stay a later Payment through Record payment).

## Decisions

- A method marked "no longer available" counts as no method chosen and goes through `effectiveChoice` with the ids actually offered.
  - Reason: it avoids a loop of identical refusals and keeps the payment decided only through `effectiveChoice`/`validateSale`.
- "Collect {total}" stays the same label when "Owes it" is chosen.
  - Reason: the field above already says it is owed, and a different label would depart from the drawing.
- While saving, Close is silent and has no unavailable look; "Saving…" is the only signal.
  - Reason: the save is short and always ends in success or the failure text, and the owner did not want a visible change.
- The retry promise covers only refusals and requests that never reached the server.
  - Reason: closing the lost-answer case needs server work that this part does not take on.
- The title uses the copy module's plural form if there is one, otherwise "items" for any n.
  - Reason: it is a small wording point and does not block building.

## Risks

A sale whose answer was lost after the server saved it can be recorded twice on retry. That inflates Sales, Profit and, if owed, the Customer's Balance. It is a follow-up for before the flip.
Keeping "no longer available counts as no method" inside `effectiveChoice` may require changing its current rule for paid(id) and its unit tests.
The drawing NuevaVentaCobrar and its dark twin were not checked during the interview.

## Screens

The Sheet touches the UI. Its screens come from the design stage (NuevaVentaCobrar and its dark twin, accepted departure 3).

## Slices

### collect-sheet

#### Acceptance criteria

- The Collect Sheet component, its copy keys and its Testing Library tests at fetch are delivered, covering every acceptance criterion above, and vitest passes.

#### Risks

- double-record-on-lost-answer
- effective-choice-rule-change
