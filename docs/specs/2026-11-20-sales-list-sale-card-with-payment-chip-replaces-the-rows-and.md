---
status: draft
---
## Goal

Replace the rows of the Sales list with Sale cards, so the seller sees each sale's payment state at a glance and doesn't have to open the sale. Each card shows who bought, the first item with "+N more", the total with Shipping, a payment chip (paid, part paid with the amount still owed, unpaid, or "can't be shown") and a dd/mm date. The card is built for the owner working from the phone, and the computer shows the same cards, wider. The change is front-only: it shows the `payment_state` and `still_owed` the API already returns (GH-500 part 1).

## Acceptance criteria

- `Ventas.tsx` renders `.sale-card-list` with one `SaleCard` per sale at every width, and tabs, period total, count, order, loading and empty states are unchanged.
- Each `SaleCard` is one `InAppLink` with class `.sale-card` to `/sales/:id`, at least 44 px high, with its accessible name from `sales:card.name`.
- The card shows, in order: the customer's name or `sales:card.noCustomer` with no VIP badge; the first Sale line in saved order as `sales:card.item` with the existing quantity formatter and no unit word; `sales:card.more` with the count of the other lines, only when there are other lines, a Gift counting as a line; `.sale-card__total` with Shipping in Tabular figures; the payment chip; and `formatDateShort(sale.date)` in the secondary style.
- `SalePaymentChip` renders `sales:card.payment.paid` for paid, `sales:card.payment.unpaid` for unpaid, a half-filled circle and `sales:card.payment.partPaid` with `stillOwed` in the Money format for part_paid, and the decorative Attention icon with `sales:card.payment.unknown` for null, each with its `.payment-chip--*` class.
- The chip's default branch goes through `assertNever` and renders the unknown line.
- `SaleCard` and `SalePaymentChip` read only `payment_state` and `still_owed`, and neither reads `still_owing`, payments, the Customer's Balance or the browser clock.
- A long name or items line shortens with an ellipsis, the items line shrinks first, and the total and the chip never shrink or wrap.
- All colours come from tokens, using only pairs already in the design README contrast table, and part paid uses `--deuda2` on `--deuda-fondo` with the circle in `--deuda`.
- `colorCensus.ts` lists each `.payment-chip--*` state with its word or shape carrier, citing `SalePaymentChip.test.tsx`, and the `.monto-deuda` entry no longer names Ventas, "owes you" or `Ventas.test.tsx`.
- The `sales:card.*` and `sales:card.payment.*` keys are in `copy/sales.ts` and `en.baseline.json` exactly as the Tech Writer wrote them, and `owesYou` is removed, as is the VIP badge text if nothing else uses it.
- `touch.test.ts` SELECTABLE, the `closingGuards.test.ts` fixtures and the live `/* pressed */` block use `.sale-card`.
- `pressedBlock.bdc2945.ts` is untouched, and `touch.test.ts:774` still yields exactly the two interruptor violations.
- The 6 e2e edits are made in `ventasTelefono.spec.ts`, `ventasPhone.spec.ts` and `payments.spec.ts`, and `payments.spec.ts` asserts that the card's `.payment-chip` says Unpaid (D-69509906).
- A typed `saleWith(state, overrides?)` helper sets `payment_state` and `still_owed` as a pair, and no Sales-list test sets the payment state through `still_owing` or payments.
- `SalePaymentChip.test.tsx`, `SaleCard.test.tsx`, `Ventas.test.tsx` and `Ventas.phone.test.tsx` cover the listed cases, including a null-state card among intact ones and the absence of "owes you" and of any VIP badge.
- `docs/product/sales.md` describes the Sale card and chip in "En pantalla: Sales" and no longer says "`VentasCompu` sin cambios".
- A grep for `fila-venta|lista-ventas|te-debe|owesYou` in `web/` and `scripts/` hits only `pressedBlock.bdc2945.ts`.
- vitest and e2e are green, and the Mobile check gains 0 new offenders.

## Out of scope

Filtering or sorting Sales by payment state. Showing the Note, the Sale number, per-sale grams, a VIP badge or the Customer's Balance on the card. A "Today" label in place of dd/mm. Any API change, including removing `still_owing`. A dedicated computer layout or polish. A drawing of the Sale card. Redesigning the sale detail.

## Decisions

- The card does not show the Note, including for a sale without a customer.
  - Reason: today's row doesn't show it either, the Note stays in the detail, and a sale without a customer is always fully paid, so it never needs collecting.
- Every card shows the date as dd/mm from the sale's own date, today's sales included.
  - Reason: it reads the same on every card and needs no clock, and the Today tab already says which sales are from today.
- The VIP badge, the per-sale grams and the amber "owes you" total leave the list and are never brought back, visible or hidden.
  - Reason: they don't serve the job of seeing each sale's payment state; the grams stay in the detail, and D-69509906 forbids re-adding a removed landmark.
- On 900 px and wider the Sales list shows the same Sale cards, and `VentasCompu.dc.html` is superseded for the list.
  - Reason: the human decided it (Decision 1, Drawing departure #1 accepted); `Ventas.tsx` is one list for both widths, and the computer gets no dedicated polish (Phone first).
- There is no filter by payment state.
  - Reason: the job is to read the state per sale, and Customers' "Owed to you" already lists who owes what.

## Risks

A colour pair the chip needs might not be in the design README contrast table; the build must stop and report rather than add a pair.
`docs/assets/screens/Ventas.webp` shows the old rows until the screen image is re-taken from the built app.
Removing the `.fila-venta` landmark could leave a stale e2e or guard reference; the done-when grep and the 6 listed e2e edits close that.

## Screens

The Sales list screen (phone, and computer at 900 px and wider) is touched; its screens come from the design stage.

## Slices

### sales-list-sale-card

#### Acceptance criteria

- `Ventas.tsx` renders one `SaleCard` per sale in `.sale-card-list` at every width, each a single link of at least 44 px to `/sales/:id` showing the customer or No customer, the first line with "+N more", the total with Shipping, the payment chip and the dd/mm date.
- `SalePaymentChip` renders paid, part paid with circle and amount, unpaid, and for null or unknown values the Attention icon with "Payment can't be shown", through an exhaustive `assertNever` switch.
- No file in `web/` or `scripts/` other than `pressedBlock.bdc2945.ts` names `fila-venta`, `lista-ventas`, `te-debe` or `owesYou`.
- vitest and e2e are green, and the Mobile check gains 0 new offenders.
- Every payment-state colour selector is in `COLOR_CENSUS` with its word or shape carrier.

#### Risks

- contrast-pair-missing
- stale-screen-image
- e2e-landmark-migration
