---
status: accepted
date: 2026-10-03
---

# The panel is composed from each owner's own figures, in one `GET /panel`

Inicio's panel (docs/product/results.md) shows, for today, this week and this month,
figures that five hexagons already own: sales totals and grams, cost of goods, purchases,
expenses, payments received, debts and stock levels. It must never disagree with Ventas,
Te deben and Stock. Whoever sums a figure a second time becomes a second author of it.

## Decision

- **`app/results/` is a hexagon of its own** and declares one port per owner in
  `app/results/application/ports.py`: `PeriodSales` (sales), `StockFigures` (stock),
  `PeriodExpenses` (expenses), `PaymentsReceived` and `DebtSummary` (payments). Each is
  implemented in the owner's `adapters/` and wired in `app/main.py` as a
  `(Session, business_id)` factory on `app.state` (ADR-0006).
- **Each owner computes its own figure.** No code under `app/results/` reads another
  capability's tables. Where an owner has no function for a figure yet, it gains a pure
  one in its own `domain/`, summing rows its own repository loads. There is no SQL `SUM`.
  - Sales: `SqlSales.between(start, end)`, in two statements whatever the number of
    sales (the sale rows, then their lines), sharing `list_views`' own date predicate so
    a period selects exactly what Ventas lists. Then `period_summary` over `Sale.total`
    and the lines' pricing rule. The `Sale`s it builds carry no payment and are never
    written back.
  - Payments received: the `payment` rows by `paid_on`, on-the-spot and later alike, not
    through `Ledgers`, since a sale without a customer is in no ledger but its payment
    counts in Caja.
  - Expenses: `SqlExpenses.between(start, end)`.
  - Stock: one `lots_and_draws` load of the whole business per request feeds both
    `stock_level` and `cost_of_goods`. That function runs `allocate` unchanged over each
    variety's full history and sums the `costed` of sale-line draws dated in each period.
    A negative adjustment stays in the lot order, and its cost is not summed. Purchases
    are summed from the purchase entries of that same load.
- **One `GET /panel` with no parameters** answers all three periods, debts and stock.
  `periods(today)` in results' domain sets the bounds from `get_today`. Profit, cash and
  the half-up average are integer arithmetic in results' domain. The tab switch fetches
  nothing.
- **The Te deben teaser** comes from `debtors()`, re-sorted by
  `(−balance, owing_since, fold(name), customer_id)` and cut to `TEASER_SIZE = 3`. The
  total owed and the count of sales still owing are passed through.

## Consequences

- One panel read costs O(entries + sale lines) of the business for stock, plus
  O(sales + payments) for debts, plus the periods' sales, payments and expenses. We
  revisit if it misses 300 ms.
- The panel's figures come from several independent reads (pysqlite's legacy mode,
  ADR-0012). A partner's write landing between them can leave one open where, say,
  Caja counts an on-the-spot payment that "Vendiste hoy" does not yet count. The next
  open corrects it. "Never disagrees" holds for a quiescent business, which is what the
  agreement tests check. We revisit if the app leaves the legacy mode, or when it is
  published.
- Ventas still sums its own total in the browser. Agreement is pinned by tests, not by
  construction.
- A new figure on the panel means a new owner function and a port method, never a query
  in results.

## Considered and rejected

- **One port per figure**: stock's levels, cost of goods and purchases would each load
  the history, against ADR-0010's single source for stock and pending.
- **A route per period with date parameters**: every tab switch replays every variety's
  stock and every customer's settlement for figures that don't depend on the period.
- **SQL aggregates in a results adapter**: a second author of `Sale.total`, of the
  payment kinds and of the purchase origin, invisible to the architecture test.

## Amendment (GH-70): the panel's period figures come from ADR-0020's scan

Inicio's Ganancia left out stock shortfall and kept the sales of pending grams, so it
disagreed with Análisis's profit for the same week or month (PM: bug). The panel had
become a second author of profit, against ADR-0020's "#7 … adds a use case and a route,
never a second sum".

**Supersedes**, for period figures only: the "Each owner computes its own figure"
bullet's Sales, Expenses, Payments received and Stock sub-bullets ("`SqlSales.between`
… `period_summary`", "`SqlExpenses.between`", "the `payment` rows by `paid_on`" and
"one `lots_and_draws` load … feeds both `stock_level` and `cost_of_goods`"), and
"Profit, cash and the half-up average are integer arithmetic in results' domain" as far
as profit and cash go. Debts and the stock rows still come from their owners.

### Decision

- **Every period figure on the panel, Hoy included, comes from ADR-0020's computation.**
  `period_figures.py` makes its bucket pass public as `scan(draws, sales, payments,
  expenses, purchases, earliest_entry_day)` and answers any `[start, end]` through
  `totals_between(buckets, start, end) -> PeriodTotals`: sales, sales count, grams sold
  and gifted, cost of goods, stock shortfall (or none), expenses, purchases, profit and
  cash. `_weeks`, `_months` and the since-first-record figures read the same function;
  the profit and cash formulas are written once, in `Buckets`. `average_sale` stays as
  presentation arithmetic over one `PeriodTotals`.
- **One read per source.** `read_panel` feeds `scan` from the same `SalesLedger`,
  `PaymentsLedger`, `ExpensesLedger` and `Purchases` ports `analyse` uses.
  `StockFigures.read(today)` answers the stock rows and the `DrawRow`s from one entries
  load, one sale-draws load and one `lots_and_draws`, through one draw-row builder in
  `app/stock/adapters/` shared with `SqlDrawCosts` (the only code that decides a draw's
  `kind` or calls `allocate` for results). `SqlPurchases` is the only author of
  `PurchaseRecord`.
- **Deleted**: `PeriodSales`, `PeriodExpenses` and `PaymentsReceived` with their
  adapters, wiring and tests; `sales/domain/period_summary.py`;
  `expenses/domain/period_total.py`; `app/stock/domain/cost_of_goods.py`;
  `purchases_in` when it has no other caller; `arithmetic.profit` and `arithmetic.cash`.
- **The answer** gains, per period, `shortfall: {amount, pending} | null` (null exactly
  when the period has no negative adjustment) and `profit_pending`. `pending_cost` keeps
  its meaning: sale-line draws only. The backend decides all three flags from each
  figure's own pending grams; the front reads one flag per note and never combines them.
  No grams cross the wire (PM).
- **Bounds**: `periods()` builds the week and the month from `app/shared/calendar`'s
  `Week.containing` and `Month.containing`; no other module derives a Monday or a
  month's last day.
- **Agreement is tested through HTTP** with the clock on Friday 2026-10-02, so Hoy,
  the week and the month each hold records the others don't, comparing `GET /panel`'s
  week and month with `GET /analysis`'s rows (0 differences) and Hoy with values worked
  out by hand.

### Consequences

- A panel open now replays the business's whole history once:
  O(entries + draws + sales + payments + expenses), the shape Análisis has (ADR-0020,
  measured at 40–50 ms on a seeded year), plus debts as before. A test asserts the same
  number of statements on a small seeded business as on a big seeded one — a freshly
  opened (empty) business is not the right comparison, since SQLAlchemy skips the price
  entries' `selectinload` statement outright with no parent rows, and `SqlLedgers.all()`
  issues none of its own three with no customers; measured at **16 statements**, equal
  for both seeds (`tests/results/test_panel_router.py::
  test_get_panel_issues_the_same_number_of_statements_small_or_seeded`).
- The split read of this ADR's Consequences no longer exists *within* the period
  figures: Vendiste, Ganancia and Caja come from one scan. It remains between the period
  figures, debts and the stock rows.
- ADR-0020 needs no amendment: its rule is now true of the code.
- **Isolation proof, run by hand**: removed the `business_id` filter from the combined
  stock read — `SqlStockEntries.for_varieties`' `WHERE` and every `ON` clause of
  `SqlDraws.for_varieties`' two joins plus its own `WHERE` — leaving only the per-row
  `StockEntryRow`/`SaleLineRow` selects unfiltered. `tests/test_business_isolation.py::
  test_another_business_reads_the_panel_as_zero_while_a_has_every_figure` failed
  (business B's `today.cost_of_goods`, `grams_sold`, `grams_gifted` and `profit` all
  leaked business A's figures). Restored both filters; the sweep passed again, and
  `ruff`/`mypy` were clean throughout.
