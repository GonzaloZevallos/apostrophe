"""`SqlLineCosts`: sales' `LineCosts` port (`app/sales/application/ports.py`),
implemented from stock's own data (ADR-0009). Sales never imports `app.stock`
(CODING_STANDARDS section 1); this adapter is the one place that import runs, wired
once onto `app.state.line_costs` in `app/main.py`.

The real draw: `allocate` over `history` (stock-application) replay a variety's lots
and draws fresh on every call, read through `StockEntries`, `Draws` and `WithdrawalDraws`
narrowed to the sale's own varieties (ADR-0009's performance note) — never frozen, never
stored on the line. This is the one place stock's code imports `app.sales` at all (its own hexagon
root may; CODING_STANDARDS section 1 restricts only `domain/` and `application/`, which
stay pure of any other hexagon): sales' `Sale`, `SaleLine` and `LineCost` types.
"""

from __future__ import annotations

from sqlalchemy.orm import Session

from app.sales.application.ports import LineCost
from app.sales.domain.sale import Sale
from app.stock.adapters.sql_draws import SqlDraws
from app.stock.adapters.sql_stock_entries import SqlStockEntries
from app.stock.adapters.sql_stock_withdrawals import SqlStockWithdrawals
from app.stock.application.history import history
from app.stock.application.ports import Draws, StockEntries, WithdrawalDraws
from app.stock.domain.allocation import DrawCost, allocate
from app.stock.domain.lot_order import SALE_LINE_RANK


def costs_for_sale(
    entries: StockEntries, draws: Draws, withdrawals: WithdrawalDraws, sale: Sale
) -> list[LineCost]:
    """One `LineCost` per line of `sale`, in the same order as `sale.lines`. Only the
    varieties on this sale are read, narrowed through `for_varieties`."""
    variety_ids = {line.variety_id for line in sale.lines}
    grouped = history(entries, draws, withdrawals, variety_ids)

    by_variety_position: dict[tuple[int, int], DrawCost] = {}
    for variety_id in variety_ids:
        lots, variety_draws = grouped.get(variety_id, ([], []))
        for draw, result in zip(variety_draws, allocate(lots, variety_draws), strict=True):
            if draw.order.rank == SALE_LINE_RANK and draw.order.ref_id == sale.id:
                by_variety_position[(variety_id, draw.order.position)] = result

    costs: list[LineCost] = []
    for position, line in enumerate(sale.lines):
        result = by_variety_position[(line.variety_id, position)]
        costs.append(LineCost(costed=result.costed, pending_grams=result.pending))
    return costs


class SqlLineCosts:
    def __init__(self, session: Session, business_id: int) -> None:
        self._entries = SqlStockEntries(session, business_id)
        self._draws = SqlDraws(session, business_id)
        self._withdrawals = SqlStockWithdrawals(session, business_id)

    def for_sale(self, sale: Sale) -> list[LineCost]:
        return costs_for_sale(self._entries, self._draws, self._withdrawals, sale)
