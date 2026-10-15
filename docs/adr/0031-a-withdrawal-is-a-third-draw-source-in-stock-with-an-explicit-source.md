---
status: accepted
date: 2026-10-06
---

# A withdrawal is a third draw source in `app/stock/`, told apart by an explicit `DrawSource`, ordered after a sale line on an exact tie

GH-83 adds stock withdrawals (Promoción, Consumo propio): grams leaving a variety that
are not a sale. They take grams off lots, so they cost what `allocate` says (ADR-0009,
ADR-0010), but they are never a sale and never a shortfall.

## Decision

- **They live in `app/stock/`, not in a new hexagon.** The glossary makes a withdrawal a
  Draw; lots, `LotOrder`, `allocate` and `stock_level` are stock's domain; `stock_router`
  already runs upkeep after commit (ADR-0014). Nothing outside stock reads withdrawals
  except results, through the existing `DrawCosts` and `StockFigures` rows.
- **`Draw` gains a required `source: DrawSource`** (`ADJUSTMENT`, `SALE_LINE`, `PROMOTION`,
  `OWN_USE`). No code tells a draw's kind by a missing `sale_id` or pricing rule any
  more, and every branch over `DrawSource` or results' `DrawKind` is an exhaustive
  `match` with `assert_never`.
- **`WithdrawalLineDraw` sits next to `SaleLineDraw`, with `WITHDRAWAL_LINE_RANK = 2`.**
  `STOCK_ENTRY_RANK = 0` and `SALE_LINE_RANK = 1` keep their values, so no existing order
  changes. On an exact tie of day and instant: a negative adjustment, then a sale line,
  then a withdrawal line. A line's `ref_id` is the withdrawal's id.
- **`lots_and_draws` takes the withdrawal draws as a required argument**, and one
  `history()` function is the only caller (every read feeding `allocate` or
  `stock_level` goes through it).
- **Results' `DrawKind`** becomes `sold | gifted | shortfall | promotion | own_use`.
  Withdrawal rows carry no variety. `scan` folds a withdrawal's day into `first_record`.

## Consequences

- A fourth source is one edit in `history()` and one in each `match`.
- Days left counts sale lines and both withdrawal sources, never adjustments.

## Amendment

`history.py` also exposes `business_history`, which reads the three sources for the whole business once and answers the stock entry rows it read with the grouped lots and draws, so `GET /stock` reads `stock_entry` once (GH-125).
