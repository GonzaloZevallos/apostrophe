---
status: draft
---
## Goal

Rebuild the Sale detail screen (`/sales/:id`) on `SaleCustomerCard` and `SaleDetailCard` following the VentaDetalle drawings, as one layout for phone and computer, so the seller who has just recorded a sale (or is asked about one) sees who it was for, what was taken, what it came to and whether it is paid, and sends the Sale bill in one tap from the title row. Part 2 of 2 of GH-1116.

## Acceptance criteria

- `useSaleBillShare` is called exactly once at the top of `VentaDetalleScreen`, before the error and pending returns, with `state`, `refreshing` (assign pending or awaiting the assigned customer) and `onCopied` as specified.
- The title row is a `role=group` labelled by the h1 "Sale #N" and holds a round icon-only button named "Share" (`sales:detail.share`), shown only while `share.sharing` and a bill exists, disabled and `aria-busy` while `share.busy`, calling `share.onTap`; the screen has no Back control of its own.
- The screen order is title row, Undo notice, `SaleCustomerCard`, `SaleDetailCard`, toasts and errors, `SaleBillButton`, Void row; a screen test checks the reading order Sale #N, Customer, payment chip, lines, Total.
- `SaleCustomerCard` receives the language from `i18n.language`, `methodName` from `payment_method?.name ?? null`, and `onAssign` only without a customer, disabled while refreshing; a paid sale with a method reads "Paid · <method>".
- `SaleBillButton` is presentational (`share`, `hasBill`), draws nothing without a bill, always offers Copy (never Share), alone renders the failure notice and the copy-by-hand region named "Sale bill", and sits in a `role=group` named "Sharing the bill" (`sales:bill.actionsName`); all its text comes from `t()`.
- "Share" appears once on the screen; after a failed share the title-row Share is hidden and the block reads Copy.
- Elements of the drawing stay when their data exists and are hidden when it does not; no price shows a unit or "per gram".
- The loading state matches the loaded layout, is `aria-busy` and labelled "Loading sale", shows no digit and no currency symbol, and stays within `CONTENT_SHIFT_PX`; the gone state is unchanged.
- The listed dead `.venta-detalle__*` rules are deleted and `grep -r venta-detalle__linea web/` returns nothing; `__acciones`, `__botones`, the Void scoping and `.sale-bill*` remain.
- `SALES_TEXT.paid`, `leftOwing`, `perGram` and `lines` are removed with their baseline lines; `SALE_BILL_TEXT.share`/`copy` are removed only if `copy/saleBill.test.ts` was their last reader; en-XA is regenerated.
- The two `front-exclude.json` entries for the cards are removed.
- `web/e2e/sales.spec.ts` reads each line through the "Detail" region's listitem and checks `$ 500` and `$ 5.000`; no e2e uses a removed class; the "No customer" step in `statesSales.ts` still lands on the list card.
- The four screen test files are migrated, Share is reached only through its group, and the Assign, Undo and Void tests stay green.
- No offender is added to `web/src/mobile-standard/offenders/*.json` and ci-ok is green.
- `docs/product/sale-detail.md` and `docs/product/payment-state.md` describe what ships, in Spanish, including the five owner-accepted departures.

## Out of scope

- Collect or Record payment from the detail.
- Edit sale (#561), channel tiles and image receipt (#1056).
- A delivery state or Delivered chip.
- Promotion rows (GH-318).
- A dedicated computer layout.
- Units on prices (GH-318).

## Decisions

- The price shows no unit.
  - Reason: the owner's rule hides an element whose data does not exist, and no Business has a Unit until GH-318; a fixed unit would break Assume nothing.
- The Sale bill block always offers Copy, and Share lives only in the title row.
  - Reason: the human's Decision 1 rejected a second Share; the request's label-from-share would have shown Share twice.
- Grams and summary lines are kept or hidden by reading the drawing against the data-exists rule rather than removed outright.
  - Reason: the human's Decision 1 says these are not accepted departures and the screen follows the drawing.
- The "Salida ante 'Payment can't be shown'" bullet of `payment-state.md` is rewritten alongside the new paragraph.
  - Reason: once the detail shows the chip, that bullet would be false.

## Risks

The request keeps `useSaleBillShare`'s contract unchanged, but the block must always read Copy; if the hook has no separate copy path, a minimal contract change is needed.
Which drawing elements stay (quantity, summary line) depends on reading VentaDetalle / VentaDetalleOscuro, which no role has compared yet.
`VentaDetalle.webp` will show the old detail until it is retaken after the merge.

## Screens

The screens come from the design stage.

## Slices

### sale-detail-screen

#### Acceptance criteria

- `/sales/:id` renders title row with the single round "Share", Undo notice, `SaleCustomerCard`, `SaleDetailCard`, errors, `SaleBillButton` (Copy only) and Void row, in that order, with the hook called once.
- Loading shows no digit or currency symbol and keeps the loaded shape; a failed share leaves Copy and the copy-by-hand region.
- Dead CSS, copy and front-exclude entries are removed, e2e and screen tests migrated, docs updated in Spanish, and ci-ok is green with no new offender.

#### Risks

- share-hook-copy-path
- drawing-elements-unverified
