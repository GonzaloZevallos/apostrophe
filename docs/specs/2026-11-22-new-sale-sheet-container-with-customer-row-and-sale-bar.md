---
status: draft
---
## Goal

Deliver the frame of the new-sale Sheet, `web/src/screens/ventas/NuevaVentaSheet.tsx`, for a seller handing over an order from the phone. The frame has a customer row that says who the sale is for and which prices apply, and a sale bar with the count or the total and a single Collect. It wraps the existing New sale product list. It ships hidden: nothing mounts it until the flip part of GH-496. It serves the job "see who the sale is for, which prices apply and the total so far, with one clear way to collect, so I charge the right amount and never price from memory".

## Acceptance criteria

- `NuevaVentaSheet` takes `draft`, `customer`, `onClose`, `onChangeCustomer` and `onCollect(sale)`, and passes `computer`, `computerClass` and `computerDialog` through to the shared Sheet.
- It reads with `useNewSaleReads({date: draft.state.date, openedOn: draft.state.openedOn})` and runs `pricedSaleOf` once per render in a `useMemo` with the Money format from `useMoney`. Every figure shown comes from it, and the component does no money arithmetic.
- The Sheet's touched state is `isDirty(draft.state)` and nothing else.
- The title is `COMMON_TEXT.newSale`. The Sheet's Close raises `onClose` and shows no dialog.
- The customer row shows the Customer's name, or "No customer", with one line beneath it:
  - "List prices" for a Customer with no type or when the Customer types switch is off;
  - "Prices for {type}" for a Customer with a type;
  - the compact Loading mark while the type is pending;
  - nothing after a failed read.
- While the name is pending, the compact Loading mark takes its place.
- A failed Customer read never shows "List prices", "Prices for {type}" or a money figure. The list's price marks stay loading and there is no Collect.
- "Change" (`COMMON_TEXT.change`) raises `onChangeCustomer`. It reads "Change" in every state, is flex none and at least 44×44, and keeps its label.
- Each row text stays on one line with an ellipsis, and a 60-character name keeps its full accessible name.
- The product list receives `customerTypeId = customerTypeIdOf(customer)` and the pricing.
- The sale bar is the last child of `SheetActions` and is fixed on the phone only.
- The bar's `role="status"` region shows one of four states:
  - total: "1 item · {total}" / "{n} items · {total}", with the figure never split;
  - count: "1 item" / "{n} items";
  - counting: the count plus the compact Loading mark;
  - empty: "Add a product to collect".
- Collect (`SALES_TEXT.collectShort`) renders only in the total state and raises `onCollect(state.sale)`. In any other state no Collect of any kind renders, and it is never `disabled` or `aria-disabled`.
- Each of these shows no total and no Collect: loading, refreshing, Customer pending, failed list read, failed Customer read, and an unpriced line.
- With shipping above 0, the total equals `priceSale`'s `totals.total` in the Money format.
- The bar has no promotion or saving text.
- `NEW_SALE_TEXT` gains `listPrices`, `pricesFor(type)`, `itemsCount(n)`, `itemsTotal(n, total)` and `addProductToCollect`, registered in BASELINE_ARGS and LIMITED_COPY as the request states. Each is inserted in sorted order into `en.baseline.json`. Then `npm --prefix web run i18n:baseline -- --update` runs, and the baseline check, copyLimits and productWord pass.
- The container is listed in `web/scripts/docs/front-exclude.json`. No route, navigation entry, WalkState entry, `screens.json` entry or test hook is added.
- The Testing Library tests listed for the row, the bar and Close exist and pass in the Gate, with fetch stubbed using the stubs of `NuevaVentaProductos.test.tsx` and `stubFetchWithSettings.ts`.
- The PR reports any difference in the title or in the singular "1 item" against NuevaVenta/NuevaVentaOscuro as a question for the owner.

## Out of scope

- Routing, navigation and the flip that mounts the Sheet.
- A retry on a failed read.
- Picking products and taking the payment, which belong to the product list and the Collect Sheet.
- Any promotion or saving text (departure 1 of GH-864).
- Desktop polish.
- Any server change.

## Decisions

- On a failed Customer read, the row keeps what it already has for the name (or the Loading mark) and shows no price line. There is no retry.
  - Reason: a wrong price line costs real money. A retry would need new text and a new tap target the job does not need now, and reopening the Sheet already reads again.
- "Change" is the one label in every state, "No customer" included.
  - Reason: it has one meaning, picking who the sale is for. Whether a Sale without a customer may be saved is checked at Collect.
- A difference between the written title or singular "1 item" and the drawing goes to the owner as a departure. Neither the PR nor a role decides it.
  - Reason: these strings are not in a written product definition, so under Drawing as guide they do not automatically win over the drawing.
- With the Customer types switch off, the line reads "List prices" even for a Customer with a type.
  - Reason: under Pricing settings, a disabled rule is hidden and stops applying.

## Risks

- The title or the singular "1 item" may differ from the drawing NuevaVenta/NuevaVentaOscuro. That would need an owner decision before the flip.
- With no route, the Design capture is "not compared". Layout on a real phone (ellipsis, fixed bar, 44×44 Change) is only judged by eye until the flip.

## Screens

The screens come from the design stage. This task touches the UI only through an unrouted container compared by eye to NuevaVenta and NuevaVentaOscuro.

## Slices

### new-sale-sheet-frame

#### Acceptance criteria

- `NuevaVentaSheet.tsx` renders the title, the customer row, the product list and the sale bar as above. Every figure comes from `pricedSaleOf`, and touched is `isDirty(draft.state)`.
- The customer row shows "List prices", "Prices for {type}", the compact Loading mark or nothing, following the rules above. A failed Customer read shows no price line and no figure.
- The sale bar shows the total, count, counting and empty states. Collect appears only in the total state and is never shown disabled.
- The five copy keys exist in `NEW_SALE_TEXT` and the baseline, and the copy checks pass.
- The container is in `front-exclude.json`, with no route, navigation, WalkState, `screens.json` entry or test hook.
- The listed row, bar and Close tests pass in vitest.

#### Risks

- drawing-wording-difference
- not-compared-until-flip