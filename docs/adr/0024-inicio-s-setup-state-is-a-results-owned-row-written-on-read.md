# 0024. Inicio's setup state is a results-owned row written on read; published-once is the never-cleared `last_published_at`

Status: accepted

## Context

Inicio's first run needs two per-business facts that no deletion may undo: the setup
checklist is gone, and the bot notice was dismissed. The conditions behind them (a price
today, a stock entry, a first publish, a second user) belong to other hexagons.

## Decision

- **A results-owned table.** `inicio_setup_state(id, business_id unique, checklist_gone_at,
  bot_notice_dismissed_at)`, both nullable moments from the injected clock. Migration 0012
  creates it and writes no row. Both facts are written only by `INSERT … ON CONFLICT
  (business_id) DO UPDATE SET col = COALESCE(col, excluded.col)`: never cleared, the first
  instant kept, one fact's write leaving the other as it stands.
- **One decider.** `app/results/domain/setup.py::setup_view(stored, facts)` is pure and the
  only code that says whether the checklist or the bot notice shows, and whether "gone"
  must be stored: `gone = stored.checklist_gone or (priced_today and has_stock_entry)`;
  `bot_notice = gone and (has_sale or has_stock_entry) and not ever_published and not
  dismissed`; `mark_gone = gone and not stored.checklist_gone`.
- **A write on a GET, bounded.** `read_panel` reads the stored state, then the facts,
  builds the whole answer, calls `mark_checklist_gone(now)` only when `mark_gone`, and
  commits once. A business is marked at most once in its life.
- **Published once** is `pinned_catalog.last_published_at IS NOT NULL`, which survives a
  token or channel change. `SqlPinRecorder.record` is made monotone: handed `None`, it keeps
  the stored value. No new column.
- **Ports and cost.** Results declares `PricedVarieties.any_priced_on(today)`,
  `BusinessUsers.has_partner()`, `CatalogPublishing.ever_published()`, `PeriodSales.has_any()`,
  `StockFiguresAnswer.has_entries` and its own `SetupStateStore`; each owner implements its
  own. Each is a bounded `EXISTS`/`LIMIT` probe or rides a load the panel already makes, so
  the panel gains four O(1) probes and a fixed statement count.
- **Dismissal.** `POST /panel/bot-notice/dismissal` is gated, takes no body, answers 204
  every time and adds no refusal code.
- **Narrowed `today`.** `periods.today` carries only period, sales, sales_count and
  grams_sold; `week` and `month` keep their shape.
- **Removal.** The table is in `WITHHELD_TABLES`: deleted with the business, never exported.

## Consequences

- A business that already has both required steps when this ships never sees the checklist:
  its row is written on its first Inicio read.
- **Known risk: a torn "gone" mark.** The facts are independent reads (ADR-0013, pysqlite
  legacy mode). A partner's edit between two probes could mark "gone" permanently from
  conditions never true at one instant. Accepted; revisit if facts ever come from a store
  with real snapshot reads, or if a support case shows it.
- The 300 ms budget for `GET /panel` is measured by hand, not asserted in CI.
