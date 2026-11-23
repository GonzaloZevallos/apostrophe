---
status: draft
---
## Goal

Put the Sale card built in GH-928 on the Sales list in place of the rows and the "owes you" mark. The seller, on the phone, can then tell for each sale who it was for, its total and whether it is Paid, Part-paid (with what is still owed) or Unpaid, without opening it. This part also removes the old row styles, copy, locators and exclusions that the card makes obsolete.

## Acceptance criteria

- The Sales list renders one `SaleCard` per sale inside `.sale-card-list`, at every width. Each card is a single link to its sale and is at least 44 px high.
- Each card shows, in this order:
  - the customer name, or "No customer";
  - the first line, plus "+N more";
  - the total with Shipping;
  - the payment chip;
  - the date as dd/mm.
- A part-paid sale shows "Part-paid · {amount} owed" with exactly its `still_owed` in the Business's Money format.
- A sale with a null or unreconcilable state shows "Payment can't be shown" on its own card, and the other cards are unaffected.
- No "owes you" text, amber owes-you total, VIP badge or grams per sale appear on the Sales list.
- `SALES_TEXT.owesYou` and its `en.baseline.json` entry no longer exist.
- The tabs, the period total, the count, the order, the loading state and the empty state of the Sales list behave as before.
- A grep for `fila-venta|lista-ventas|te-debe|owesYou` in `web/` and `scripts/` hits only `pressedBlock.bdc2945.ts`.
- `.fila-venta` is gone from the live `/* pressed */` block and from `SELECTABLE` in `touch.test.ts`.
- `web/scripts/docs/front-exclude.json` no longer lists `SalePaymentChip.tsx`, `SaleCard.tsx` or `salePayment.ts`, and still lists `saleWith.ts`.
- The `.sale-card*` rules in `app.css` use tokens only, with pairs already in the design README's contrast table:
  - the text column has min-width 0;
  - the name and the product line get an ellipsis, and the product line shrinks first;
  - the total and the chip never shrink, and the chip can still wrap.
- In `colorCensus.ts`:
  - every `.sale-card*` selector that uses a status colour has an entry and a test;
  - the `.payment-chip--unknown` phrase reads "can't".
- `ventasTelefono.spec.ts` and `ventasPhone.spec.ts` locate sales by `.sale-card`.
- `payments.spec.ts` finds the card by `.sale-card__total` and expects its `.payment-chip` to read `Unpaid`.
- vitest and e2e are green, and the Mobile check gains no new offenders.
- In sales.md, the "En pantalla: Sales" section no longer describes the VIP badge, the grams or the "owes you" mark on the list, and points to payment-state.md for the card.

## Out of scope

- Filtering or sorting Sales by payment state.
- Showing the Note, the Sale number, grams per sale, a VIP badge or the Customer's Balance on the card.
- Any API change, including removing `still_owing`.
- A dedicated computer layout.
- Redesigning the sale detail.
- A way to fix "Payment can't be shown" from the list.
- Editing generated docs or `screens.json` rows. `Ventas.webp` is re-taken after merge.

## Decisions

- The unknown-state text is "Payment can't be shown", not "Payment cannot be shown".
  - Reason: the human's decision 2 on GH-928 set the copy to "can't". The PRD's older wording would contradict the live Copy module.
- Remove all three GH-928 entries (`SalePaymentChip.tsx`, `SaleCard.tsx`, `salePayment.ts`) from `front-exclude.json`, not only `SalePaymentChip`. Keep `saleWith.ts`.
  - Reason: D-62e6dc23 says the part that wires a module removes its entry. This part wires all three, and `saleWith.ts` is only ever imported by tests.
- Remove `.fila-venta` from the live pressed block and from `SELECTABLE` in `touch.test.ts`.
  - Reason: D-69509906 says a removed element is never kept, visible or hidden, to satisfy a locator or a guard.
- The card shows the same layout on the computer, wider, with no dedicated polish.
  - Reason: Phone first, and the owner's decision on GH-928 that replaces `VentasCompu.dc.html` for the list.
- The count of Sales still owing leaves the Sales list and stays only in Home's "Owed to you" block.
  - Reason: the job is finding one sale and its state. The total of who owes is already answered on Home and in Customers.

## Risks

- A colour pair the card or chip needs might be missing from the design README's contrast table. The build must stop and report it rather than add a pair.
- `Ventas.webp` shows the old rows until it is re-taken after merge.
- A stale e2e, guard or pressed-list reference to `.fila-venta` could remain. The grep criterion closes it.

## Screens

The Sales list is touched. Its screens come from the design stage: the approved `Pedidos.dc.html` drawing and the drawing decisions recorded on GH-928.

## Slices

### sales-list-sale-card

#### Acceptance criteria

- The Sales list renders one `SaleCard` per sale, each a single link at least 44 px high, at every width. Tabs, period total, count, order, loading and empty states are unchanged.
- A part-paid card shows its exact `still_owed`.
- An unknown state shows "Payment can't be shown" on its own card only.
- No "owes you" text, VIP badge or grams per sale remain on the list.
- `SALES_TEXT.owesYou` and its baseline entry are gone.
- A grep for `fila-venta|lista-ventas|te-debe|owesYou` hits only `pressedBlock.bdc2945.ts`.
- `.fila-venta` is gone from the pressed block and from `touch.test.ts`.
- `front-exclude.json` no longer lists `SalePaymentChip.tsx`, `SaleCard.tsx` or `salePayment.ts`.
- The `.sale-card*` rules use tokens only. Their census entries and the "can't" phrase are in place, with tests.
- The e2e locators use `.sale-card`, and `payments.spec.ts` expects `.payment-chip` to read `Unpaid`.
- In sales.md, "En pantalla: Sales" is aligned with the card.
- vitest and e2e are green, and the Mobile check gains no new offenders.

#### Risks

- missing-contrast-pair
- stale-screen-image
- leftover-fila-venta-reference
