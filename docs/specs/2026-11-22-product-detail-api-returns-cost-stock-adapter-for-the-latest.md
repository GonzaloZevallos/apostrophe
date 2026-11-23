---
status: draft
---
## Goal

Expose on `GET /api/products/{id}` the cost of a Product, taken from its latest costed Purchase, and the margin each of its current prices gives. This serves a seller who is about to set or change a price and wants to know whether that price still makes money, without working it out by hand or in the old spreadsheet. It is the backend half of GH-968, within GH-522: a stock adapter, the wiring, the additive contract, behaviour and isolation tests, and an ADR. No screen shows the cost yet.

## Acceptance criteria

- `SqlLatestCostedPurchase(session, business_id)` in `app/stock/adapters/latest_costed_purchase.py` implements the products port `LatestCostedPurchase` with one select filtered by business, product, origin Purchase, `total_cost > 0`, `quantity > 0` and `entered_on <= day`, ordered by `entered_on DESC, recorded_at DESC, id DESC` with `LIMIT 1`.
- The adapter reads money through `scaled` and `domain_amount` and never divides.
- `app/main.py` sets `app.state.products_latest_costed_purchase` to a `(Session, business_id)` factory.
- The products router reads that factory with a cast, like `get_leaving`, and `get_product` calls the cost-and-margins use case with the loaded product, the pricing settings and today.
- `app/products/` never imports `app.stock`.
- `ProductDetailOut.cost` is `ProductCostOut | null`, with `ProductCostOut = {amount: MoneyOut | null, margins: list[PriceMarginOut]}` and `PriceMarginOut = {rule: 'list'|'bulk'|'vip', percent: int}`.
- `cost` is `null` for an Archived product and `{amount: null, margins: []}` when no costed Purchase exists.
- `amount` is at the Business's decimals, rounded half up and sent in currency units.
- Only the detail endpoint changes, and `api_breaks` reads the change as additive.
- In `tests/products/test_cost_and_margins_api.py`, $10,000 for 30 g with a list price of 11,000 gives 333 and 97 at 0 decimals, and 333.33 and 97 after raising the decimals to 2, at either scale.
- At 0 decimals, $1 for 2 g with a list price of 3 gives amount 1 and percent 83.
- Of two Purchases on the same date, the one recorded later wins.
- A Purchase dated tomorrow is ignored once the clock moves back.
- Editing the latest Purchase changes the cost, and deleting it leaves the cost pending.
- A Harvest or an Opening stock with a cost leaves the cost pending.
- A Product with no price today has no margins.
- The bulk margin follows the Bulk price setting.
- With the VIP type from `tests/vip_type.make_type(engine, is_vip=True)`, commented as the only hand-built row, and a POSTed `vip_price`, the margins come in the order list, bulk, vip.
- Customer types off removes the vip margin, and on brings it back.
- Deleting the VIP type removes the vip margin.
- A type named 'VIP' made through the API gives no vip margin.
- A Hidden product shows its cost.
- An Archived product gives `null`, and restoring it brings the cost back.
- A cost above the price gives a negative margin.
- `seed_varieties` in `tests/test_business_isolation.py` includes a costed Purchase.
- A `client`/`other_client` test shows one Business's Purchase never feeds another's cost.
- The pinned `/analysis` and `/panel` tests from the previous part pass byte for byte, with no assertion edited.
- An ADR under `docs/adr/`, in Spanish with a `summary:`, records the per-price margin from the latest costed Purchase through a products port implemented by stock, that it is a replacement cost and not the Lot order or Cost of goods sold, the amount in the unit of the Business's decimals, the `total_cost > 0` filter on read, the shared ratio rounding in `app/shared/ratio.py`, and that nothing is stored.
- No file under `docs/api/**`, `docs/architecture/generated/**` or `decisiones.md` is committed, and CI is ci-ok.

## Out of scope

- Any screen showing cost or margins (a later part of GH-522).
- Changes to any endpoint other than `GET /api/products/{id}`.
- Any change to Profit, Margin, Cost of goods sold, Home or Analysis figures.
- Storing cost or margins.
- An average or Lot-based cost.
- Margins for Customer types other than the VIP type.
- Any warning for a negative margin.

## Decisions

- The cost amount is rounded half up to the Business's decimals, using the same shared rule in `app/shared/ratio.py` as the percent.
  - Reason: the request pins $1 for 2 g as amount 1 at 0 decimals (0.50 rounds to 1), and the request names one shared place for rounding a ratio.
- A VIP margin requires Customer types on, the Business's VIP type existing, and a VIP price on the current Price entry.
  - Reason: this follows from the decided cases (Customer types off, VIP type deleted, a type named 'VIP') and from the glossary's VIP type entry.
- The product knowledge records this as a new capability, `cost-and-margins`, rather than inside `varieties.md`.
  - Reason: it is a computed, read-only figure with its own glossary concept, and keeping it apart keeps the Products screens file focused.

## Risks

`api_breaks` may flag the new `cost` property as a break. If it does, stop and report it rather than work around it.
A wrong boundary, where products imports stock, would break the hexagonal rule. The import direction must be checked.
A rounding mismatch between the amount and the percent at scale 2 could make the pinned examples fail at one scale only.

## Screens

none

## Slices

### product-detail-cost-api

#### Acceptance criteria

- `GET /api/products/{id}` returns `cost` as `null` for an Archived product, `{amount: null, margins: []}` when the cost is pending, and otherwise `{amount, margins}` with margins in the order list, bulk, vip, following the Pricing settings and the VIP type.
- The cost comes from `SqlLatestCostedPurchase`, wired through `app.state`, with no import of `app.stock` from `app/products/`.
- Every case in `tests/products/test_cost_and_margins_api.py` and the new isolation test pass.
- The pinned `/analysis` and `/panel` tests pass byte for byte.
- `api_breaks` reads the change as additive.
- The ADR exists in Spanish with a `summary:`.

#### Risks

- api-breaks-flags-new-property
- rounding-mismatch-across-scales
