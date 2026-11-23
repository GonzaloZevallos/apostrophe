---
status: draft
---
## Goal

The seller opens Home on the phone between orders. This task extends the Panel read model (`PanelOut.today`) with three server-computed figures:
- which Products are sold out or running low, in restock order;
- the week's best sellers since Monday;
- the month's Profit with its pending grams.

A later GH-497 part can then draw them, and the seller can decide what to restock and what to offer without opening Products or Analysis. This part is server only.

## Acceptance criteria

- `PanelOut.today` carries `low_stock{count, rows[{product_id, name, quantity, status}]}`, `best_sellers[{product_id, name, sales}]` and `month_profit{amount, pending_quantity}`.
- `low_stock` lists every non-archived Product whose Stock status is sold out or low, Hidden products included.
- `low_stock` excludes every Archived product and every Product with no movements at all (no Stock entry, no Sale or Gift, no Stock withdrawal).
- A Product with Sales but no Stock entries and negative Stock is listed as sold out.
- A Product with no Low-stock threshold and Stock above 0 is not listed.
- Each `low_stock` row's `quantity` is Stock as stored, negatives included, and its `quantity` and `status` equal what Products shows for that Product.
- `low_stock` rows are ordered sold out first, then low; within each group, fewest Days left first, then Products with no Days left, then name.
- `low_stock` is uncapped and `low_stock.count` equals the number of rows, from the same function.
- `best_sellers` sums, per Product, the stored totals of Sale lines from Sales dated Monday of the current week through today in the Business's day, with shipping excluded and Gifts at $0.
- `best_sellers` leaves out Sales dated after today.
- `best_sellers` drops $0 Products, breaks ties by name, keeps at most 4 rows, includes Archived and Hidden products, and is `[]` when nothing sold since Monday.
- `month_profit.amount` and `month_profit.pending_quantity` equal the Profit and the "and N g without cost" grams of the Month row of `GET /analysis`, from the same `totals_between`. They include a negative amount, and are `0` and `0` in a month with nothing recorded.
- Domain code in `app/results/domain/today_ordering.py` takes the time zone as a `tzinfo` argument and does not import `app.clock` or `zoneinfo`.
- The isolation seeder has a low Product in the other Business, and it never appears in the first Business's Panel.
- The Panel's statement count does not grow with history size; any fixed statement added is pinned by the existing ADR-0038-style test.
- Domain unit tests cover each ordering rule and each exclusion of `low_stock` and `best_sellers`. Behaviour tests cover `low_stock` against Products and `month_profit` against the Month row of `GET /analysis`.

## Out of scope

- Anything on screen: layout, wording, the empty best-sellers text in `web/src/copy/emptyStates.ts`, and the drawing check for those blocks.
- Best sellers for the month, a fallback list, a default Low-stock threshold, a server cap on low-stock rows, an archived mark on best-seller rows.
- Changes to Week, Month, What you have left or Analysis.

## Decisions

- A Product counts as "no entries" only when its Stock status is "no entries" (nothing ever moved), so a Product with Sales and no Stock entries at negative Stock is listed as sold out.
  - Reason: the glossary's Stock status defines it that way, and hiding the most urgent restock would defeat the job.
- Best sellers include Hidden products as well as Archived ones.
  - Reason: Hidden only keeps a Product out of the Catalog, and a sale made this week is a real sale.
- Best sellers count only Sales dated through today, not Sales dated later in the week.
  - Reason: the request says "Monday to today", and the job is what was charged since Monday.
- `sales` sums stored Sale line totals as charged, never repriced.
  - Reason: Today must equal what Sales shows, with no new rounding.
- `status` uses the same values Products exposes.
  - Reason: success criterion 2 compares Today and Products field by field.
- "Statement count stays constant" means it does not grow with history; fixed new statements are allowed and pinned.
  - Reason: that is invariant 7 and ADR-0038; it is how the Money in part was handled.

## Risks

Tenant isolation: the new per-Product reads must be scoped to the session's Business.
A second Days-left, status or Profit computation could make Today disagree with Products or Analysis.
A per-Product query could make the statement count grow with the number of Products.
Week and month boundaries computed outside the domain or without the tzinfo argument.

## Screens

none

## Slices

### today-low-stock-best-sellers-month-profit

#### Acceptance criteria

- `PanelOut.today` carries `low_stock`, `best_sellers` and `month_profit` with the selection, ordering and figures described in the task's acceptance criteria.
- Domain unit tests, behaviour tests against Products and the Month row of `GET /analysis`, the isolation seeder's low Product in the other Business and the constant statement count all pass.

#### Risks

- tenant-isolation
- figure-drift-from-products-or-analysis
- statement-count-growth