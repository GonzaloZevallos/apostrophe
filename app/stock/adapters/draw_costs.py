"""`DrawCosts`: results' one port for every draw, costed fresh (ADR-0009, ADR-0020).

One query each for every stock entry, sale-line draw and withdrawal-line draw of the business (each
already filtered on it, and `Draws` carries `variety_name`, `line_total` and
`pricing_rule` already attached to its row). `history` stays the one place a
variety's lots and draws are assembled, grouped and sorted (`lot_order.py`); the
grouping is handed to `build_draw_rows` (`app/stock/adapters/draw_rows.py`), the one
function that runs `allocate` and decides a draw's `kind` for results (the plan's
invariant) — `SqlStockFigures.read` shares that exact function, so the decision is
never made twice. Built for one business."""

from __future__ import annotations

from sqlalchemy.orm import Session

from app.results.application.ports import DrawCosts
from app.results.domain.ledger import DrawRow
from app.stock.adapters.draw_rows import build_draw_rows
from app.stock.adapters.sql_draws import SqlDraws
from app.stock.adapters.sql_stock_entries import SqlStockEntries
from app.stock.adapters.sql_stock_withdrawals import SqlStockWithdrawals
from app.stock.application.history import history


class SqlDrawCosts(DrawCosts):
    def __init__(self, session: Session, business_id: int) -> None:
        self._entries = SqlStockEntries(session, business_id)
        self._draws = SqlDraws(session, business_id)
        self._withdrawals = SqlStockWithdrawals(session, business_id)

    def rows(self) -> list[DrawRow]:
        grouped = history(self._entries, self._draws, self._withdrawals, None)
        return build_draw_rows(grouped)
