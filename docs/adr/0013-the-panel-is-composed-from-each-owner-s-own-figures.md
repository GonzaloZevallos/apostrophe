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
