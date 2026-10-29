"""`SqlStockFigures`: results' `StockFigures` port (`app/results/application/ports.py`),
implemented from stock's own data (ADR-0009, ADR-0006, ADR-0013 amendment GH-70).
Results never imports `app.stock`; this adapter is the one place that import runs,
wired once onto `app.state.stock_figures` in `app/main.py` — the same shape
`SqlLineCosts` already wires `app.state.line_costs` onto.

One `history` load answers the panel's stock rows and its draws together
(plan invariant): `for_varieties(None)` entries, sale-line draws and withdrawal-line
draws are each read exactly once per call, then grouped once. The draws are turned into
`DrawRow`s by
`build_draw_rows` (`app/stock/adapters/draw_rows.py`), the same function
`SqlDrawCosts` uses — cost of goods and purchases are no longer summed here at all;
`read_panel` feeds these draws into `period_figures.scan`/`totals_between` instead
(ADR-0020's one computation). `today` is the one passed in; this adapter never reads
the clock.
"""

from __future__ import annotations

from datetime import date

from sqlalchemy.orm import Session

from app.results.application.ports import StockFiguresAnswer, StockRow
from app.stock.adapters.draw_rows import build_draw_rows
from app.stock.adapters.sql_draws import SqlDraws
from app.stock.adapters.sql_stock_entries import SqlStockEntries
from app.stock.adapters.sql_stock_withdrawals import SqlStockWithdrawals
from app.stock.adapters.sql_thresholds import SqlThresholds
from app.stock.application.history import history
from app.stock.domain.stock_level import stock_level
from app.varieties.adapters.sql_varieties import SqlVarieties


class SqlStockFigures:
    def __init__(self, session: Session, business_id: int) -> None:
        self._entries = SqlStockEntries(session, business_id)
        self._draws = SqlDraws(session, business_id)
        self._withdrawals = SqlStockWithdrawals(session, business_id)
        self._thresholds = SqlThresholds(session, business_id)
        self._varieties = SqlVarieties(session, business_id)

    def read(self, today: date) -> StockFiguresAnswer:
        grouped = history(self._entries, self._draws, self._withdrawals, None)
        threshold_map = self._thresholds.all()

        rows: list[StockRow] = []
        for variety in self._varieties.listed():
            assert variety.id is not None, "only a stored variety is read"
            lots, draws = grouped.get(variety.id, ([], []))
            threshold = threshold_map.get(variety.id)
            level = stock_level(lots, draws, threshold, today)
            rows.append(
                StockRow(
                    variety_id=variety.id,
                    name=variety.name.value,
                    quantity=level.quantity,
                    status=level.status,
                    sold_out_since=level.sold_out_since,
                    threshold=threshold.quantity if threshold is not None else None,
                    days_left=level.days_left,
                )
            )

        draw_rows = build_draw_rows(grouped)
        return StockFiguresAnswer(rows=tuple(rows), draws=tuple(draw_rows))
