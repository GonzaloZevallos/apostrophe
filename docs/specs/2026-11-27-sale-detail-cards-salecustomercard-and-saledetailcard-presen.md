---
status: draft
---
## Goal

Build the two presentational cards for the restyled Sale detail: `SaleCustomerCard` and `SaleDetailCard`, in `web/src/screens/ventas/`. On the phone, the seller will see who bought, when, the payment state, each line, shipping and the total without scrolling sideways, and can assign a customer to a sale that has none. This part only builds and tests the cards. They are not wired into any screen and are listed in `web/scripts/docs/front-exclude.json`, so nothing visible changes yet.

## Acceptance criteria

- `SaleCustomerCard` renders the avatar with initials, or the person icon in the same `.avatar` circle when there is no customer. Both are aria-hidden.
- The name is plain text, never a link. With no customer it reads "No customer" via `sales:card.noCustomer`.
- The date line is exactly `formatWeekdayDay(date, language)`, muted, with no time, channel or year added.
- `SalePaymentChip` receives `state=paymentState`, `stillOwed` and `method=methodName`, and the card does not compute the state. Paid reads "Paid · <method>", Part-paid and Unpaid read as on the Sales card, and a null state reads "Payment can't be shown".
- "Assign customer" (new `t()` key) is a secondary button rendered only when `onAssign` is given. It is disabled when `assignDisabled` is true and has no reason text. Tests show it with no customer and absent when there is a customer.
- `SaleDetailCard` renders a section labelled by an h2 from `sales:detail.heading`.
- Each line is an `li` in a `ul`, rows separated by hairlines, in this DOM order: a `cifra-n` "N ×" nowrap; the Product name in a truncating span (min-width 0, overflow hidden, ellipsis, nowrap); a `cifra-n` "· <symbol> price" in the Business's Money format with no unit, nowrap; `ReglaInsignia` only when the rule is not list; the line total in `cifra-s`, nowrap, pushed right.
- List rows have no badge. Bulk, customer type, legacy VIP, gift and special rows show theirs, and every rule shares the same row shape with the recorded price and total.
- A `dl` shows Shipping charged (`sales:detail.shipping`, text "Shipping charged") only when `shipping_charged` > 0, then Total (`sales:detail.total`) with its dd in `cifra-xl`, nowrap.
- The Note shows in a `p` with no label only when it is not blank.
- With a 60-character name and nine-digit figures, the name carries the truncating class and each figure is one node holding the Money format symbol and its digits.
- No new class name starts with `venta-detalle__linea`. CSS uses design tokens only.
- Text is read only through `t()`. Nothing is imported from `web/src/copy/*.ts`, and `copyImports.json` is unchanged.
- New keys are in `web/src/copy/locales/en/sales.json`, existing keys with the same text are reused, en-XA is regenerated and the parity test passes.
- Both components are listed in `web/scripts/docs/front-exclude.json` and nothing imports them.
- `ci-ok` is green.

## Out of scope

- Wiring the cards into the Sale detail screen and removing the `front-exclude.json` entries (part 2 of GH-1116).
- Any Collect or Record payment action on a sale.
- A reason text next to a disabled Assign button.
- Adding a year to the date line or changing `formatWeekdayDay`.
- Any change to the Sale bill or its Share / Copy.

## Decisions

- The shipping row reads "Shipping charged", not "Shipping".
  - Reason: it is the glossary's on-screen word for Shipping charged. "Shipping cost" is an Expense, so a bare "Shipping" invites confusion.
- The Note is a bare paragraph with no label.
  - Reason: a Note is the seller's own reminder, and a label adds a key and a line on the phone with no gain.
- The date line is exactly `formatWeekdayDay` with no year added.
  - Reason: the card has no "today" to compare against and the job is mostly recent sales. A year, if needed later, belongs in the shared formatter.
- A disabled Assign button is only greyed, with no reason text.
  - Reason: the card receives only a boolean, so a reason would be a guess. The wiring screen knows why and decides.
- Gift and Special price lines keep the same row shape as every other line, showing the recorded price and total.
  - Reason: the Pricing rule and price are stored with the line and never recomputed, and one row shape keeps the figure column readable.
- Sale detail offers no Collect action.
  - Reason: Record payment opens from debtor rows and the Customer's card, never from a Sale.

## Risks

Part 2 might drop the Sale bill's Share / Copy when it swaps in the cards. That is noted for part 2.
These decisions were not compared with VentaDetalle / VentaDetalleOscuro because nothing is visible yet: the "Shipping charged" wording, the Note with no label, one row shape for Gift lines, and the greyed Assign button with no reason. Part 2 checks them under Drawing as guide.

## Screens

none

## Slices

### sale-detail-cards

#### Acceptance criteria

- `SaleCustomerCard` and `SaleDetailCard` exist in `web/src/screens/ventas/` and render as described in the Spec's acceptance criteria. Their Testing Library tests cover the chip states, no customer and Assign, the name not being a link, badges per rule, hidden shipping at 0, the Note, a price with no unit, and truncation with whole figures.
- Copy keys are added or reused in `sales.json`, en-XA is regenerated, and the parity test passes.
- Both components are listed in `web/scripts/docs/front-exclude.json` and imported by nothing.
- `ci-ok` is green.

#### Risks

- none
