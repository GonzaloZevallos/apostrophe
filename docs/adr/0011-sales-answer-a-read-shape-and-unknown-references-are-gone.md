---
status: accepted
date: 2026-10-03
---

# Sales answer a labelled read shape; an unknown customer or variety is gone (404); payment may be omitted

The sales screens (#20) need, for every sale they list or show, the customer's name and
current VIP flag and each line's variety name. `SaleOut` carried only ids. Sales also
answered 422 for a customer or variety that does not exist in the business, while the
PRD and ADR-0008 file "another business's customer or variety" as gone. And a body could
not say "no payment method", so `PaymentRequired` was unreachable over HTTP and a $0 sale
had to be sent as `"owing"`.

## Decision

- **A read port, `SaleViews`**, declared in `app/sales/application/ports.py` and
  implemented by `SqlSales`, answers `SaleView`: the `Sale`, `customer: {id, name, vip} |
  null` and a variety name per line. The list is two statements whatever the number of
  sales (sales `LEFT JOIN customer`, lines `JOIN variety` over the listed ids), and every
  joined table is filtered on the repository's `business_id` in the `ON` clause as well as
  the `WHERE`. Every sales route, writes included, answers this shape by reading the
  stored sale back. `SaleOut.customer_id` is replaced by `customer`; lines gain
  `variety_name`.
- **`UnknownCustomer` and `UnknownVariety` are `LookupError`s**, like `CategoryNotFound`,
  registered under 404 with `SaleNotFound`: `sale.customer_not_found`,
  `sale.variety_not_found`, `sale.not_found`, all kind `gone`. Missing and foreign stay
  indistinguishable. Nueva venta overrides the gone dispatch for the first two: the form
  stays open with everything typed and shows the generic line.
- **`SaleIn.payment` is optional.** Omitted means no method and not left owing, so a $0
  sale is sent with no payment and `sale.payment_required` is reachable. `"owing"` keeps
  its meaning. This widens nothing across businesses: a body without `payment` now reaches
  the domain, for the session's own business only.
- **`GET /api/products` takes an optional `on` date** (today when omitted), and each
  variety's current price is the one in force on that date: one request per date change in
  Nueva venta, inside the existing sweep.

## Consequences

- The isolation sweep's six sales assertions move from 422 to 404, and the seeded sale
  uses the `MARKER` customer and variety so a leaked join shows in the list check.
- Tests that read `customer_id` from a sale answer read `customer.id`.
- The customer's name and VIP flag in a sale's answer are current, not as at recording
  time; how a line was priced stays in its stored rule (ADR-0003).

## Considered and rejected

- **The front joins `GET /customers` and `GET /api/products`**: every Ventas load downloads
  every customer's phone to label a list, and a customer created after the cache loaded
  goes unlabelled.
- **Keeping 422 for unknown references**: the codes would be kind `refusal`, against the
  PRD and ADR-0008's status-to-kind rule.
- **Calling `/api/products/{id}/current-price?on=` per variety**: N requests per date change
  through a route outside the refusal contract.
