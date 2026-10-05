---
status: accepted
date: 2026-10-04
---

# Period figures are summed once, in a results hexagon, from one pass of draw costs

Analysis (docs/product/analysis.md) must show sales, cost of goods sold, stock shortfall,
expenses, profit and cash per week, per month and since the first record, and every
figure must equal Results' (#7) for the same period: one computation, not two. When
Analysis was planned, #7 had no code and no PRD, and nothing in the app summed anything
over a period. ADR-0010 left open how a negative adjustment's draw counts; PM has since
decided it (stock shortfall, CONTEXT.md).

## Decision

- **One hexagon, `app/results/`, owns every period figure.** A pure
  `app/results/domain/period_figures.py` turns a ledger of dated facts into sales, cost
  of goods sold (costed amount plus pending grams), stock shortfall, expenses, profit
  and cash for any `[start, end)`. Analysis is one use case over it
  (`application/analyse.py`); #7's panel will be a second use case in the same hexagon,
  not a second hexagon. This task builds #7's computation, not its screen or route.
- **Draw costs come from one pass per request.** `DrawCosts` is declared in
  `app/results/application/ports.py` and implemented in
  `app/stock/adapters/draw_costs.py`: `lots_and_draws` over every variety of the
  business once, `allocate` once per variety, one row per draw with `variety_id`, `day`,
  `kind` (`sold | gifted | adjustment`), `grams`, `costed` and `pending`. A line is
  gifted only by its stored pricing rule `gift`, read in that adapter; stock's domain
  stays unaware of gifts.
- **The other facts come through ports results declares** (ADR-0006), each implemented
  by its owner's adapters and wired as factories in `app/main.py`: `SalesLedger`
  (sales), `PaymentsLedger` (payments), `ExpensesLedger` (expenses) and `Purchases`
  (stock).
- **A negative adjustment's draw is stock shortfall** (PM): never in a variety's grams,
  cost or margin, always subtracted from profit on the adjustment's date, from its lots
  as they stand today; its part beyond every lot is pending.
- **Pending grams leave their sales out of margin and profit** (PM): sales of costed
  grams are, per line, line total × costed grams ÷ line grams, half up; the sales and
  share columns keep the full figures. `costed_sales` in `app/results/domain/` rounds
  once per line; a line's pending sales are always `line_total − costed_sales`. A line's
  total, rule, costed amount and pending grams arrive on one `DrawCosts` row, so nothing
  joins lines to costs by key.
- **Each pending mark's N is the grams behind that figure** (PM): profit counts pending
  grams sold, gifted and taken by negative adjustments; stock shortfall its own; a
  variety's margin and the average margin only sold and gifted. Each counts in its draw's
  own period, computed in `period_figures` and answered by the API.
- **Calendar boundaries are shared.** `Month` moves from expenses to
  `app/shared/calendar.py`, raising a plain `ValueError`, with `Week` (Monday to Sunday)
  beside it; expenses keeps `InvalidMonth` (`expense.month_invalid`) by translating it.
- **The API decides every figure, mark, sort and percentage.** `GET /analysis?month=`
  answers them; percentages are whole, `floor(x + 1/2)` over `Fraction`, `null` when not
  shown. The front formats only.

## Consequences

- Every open of Análisis replays the business's whole history once:
  O(entries + draws + sales + payments + expenses). `period_figures` scans each ledger
  once into day buckets and every window reads the buckets; `GET /analysis` runs the same
  number of SQL statements on a nearly empty business as on a year of history, which a
  test asserts. **Measured** (integration pass, `_seed_bigger_history`'s seeded year —
  8 varieties, 120 sales and 120 expenses spread over 360 days — against an in-memory
  SQLite `GET /analysis`): **40–50 ms**, three runs, well inside the 300 ms budget; never
  asserted in CI, since a different machine's absolute number means nothing — we revisit
  if it misses.
  - **Isolation proof run once, by hand, this pass**: `SqlSalesLedger.all()`'s
    `.where(SaleRow.business_id == self._business_id)` was removed; immediately
    `tests/test_business_isolation.py::test_another_business_s_analysis_is_exactly_the_empty_shape`
    failed (the other business's `weeks`/`weekdays` picked up the seeded business's own
    activity); the filter was restored and the test passed again. The sweep does catch a
    missing filter, at least for the ledger that carries it.
- Expense breakdowns group by `category_id` and order by the stored `name_key`, as Gastos
  does; a behaviour test ties Análisis's month breakdown to `GET /expenses?month=`.
- #7 inherits the period function, the shortfall rule and the costed-sales rule; its
  task adds a use case and a route, never a second sum.
- Ventas' "Semana" is still computed in `web/src/format/dates.ts`, an older shape left
  as it is.

## Considered and rejected

- **A separate `app/analysis/` hexagon**: it could reach #7's figures only through a port
  wired in `app/main.py`, a seam inside what is meant to be one computation.
- **Reusing `SqlLineCosts.for_sale`, or allocating per window**: 21 or more replays of
  every variety's history per open.
- **Telling a gift by a $0 line total**: 0,01 g at $10 rounds to a $0 list line.
- **Leaving a negative adjustment out of profit**: the lots it uses up would leave the
  books without ever reaching a profit figure.
