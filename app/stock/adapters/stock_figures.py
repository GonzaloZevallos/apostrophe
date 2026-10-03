"""`SqlStockFigures`: results' `StockFigures` port (`app/results/application/ports.py`),
implemented from stock's own data (ADR-0009, ADR-0006). Results never imports
`app.stock`; this adapter is the one place that import runs, wired once onto
`app.state.stock_figures` in `app/main.py` — the same shape `SqlLineCosts` already
wires `app.state.line_costs` onto.

One `lots_and_draws` load answers the panel's stock rows, cost of goods and purchases
together (plan invariant): `for_varieties(None)` entries and sale-line draws are each
read exactly once per call, then grouped once; every period's `cost_of_goods` and
`purchases_in` run over that same grouping and that same entry list, never a second
load. `today` is the one passed in; this adapter never reads the clock.
"""

from __future__ import annotations

from collections.abc import Sequence
from datetime import date

from sqlalchemy.orm import Session

from app.results.application.ports import CostOfGoods as ResultsCostOfGoods
from app.results.application.ports import StockFiguresAnswer, StockRow
from app.results.domain.periods import Period
from app.stock.adapters.sql_draws import SqlDraws
from app.stock.adapters.sql_stock_entries import SqlStockEntries
from app.stock.adapters.sql_thresholds import SqlThresholds
from app.stock.domain.cost_of_goods import cost_of_goods as _cost_of_goods
from app.stock.domain.lot_order import lots_and_draws
from app.stock.domain.purchases import purchases_in as _purchases_in
from app.stock.domain.stock_level import stock_level
from app.varieties.adapters.sql_varieties import SqlVarieties


class SqlStockFigures:
    def __init__(self, session: Session, business_id: int) -> None:
        self._entries = SqlStockEntries(session, business_id)
        self._draws = SqlDraws(session, business_id)
        self._thresholds = SqlThresholds(session, business_id)
        self._varieties = SqlVarieties(session, business_id)

    def read(self, today: date, periods: Sequence[Period]) -> StockFiguresAnswer:
        all_entries = self._entries.for_varieties(None)
        sale_draws = self._draws.for_varieties(None)
        grouped = lots_and_draws(all_entries, sale_draws)
        threshold_map = self._thresholds.all()

        rows: list[StockRow] = []
        for variety in self._varieties.all():
            assert variety.id is not None, "only a stored variety is read"
            lots, draws = grouped.get(variety.id, ([], []))
            threshold = threshold_map.get(variety.id)
            level = stock_level(lots, draws, threshold, today)
            rows.append(
                StockRow(
                    variety_id=variety.id,
                    name=variety.name.value,
                    grams=level.grams,
                    status=level.status,
                    sold_out_since=level.sold_out_since,
                    threshold=threshold.grams if threshold is not None else None,
                    days_left=level.days_left,
                )
            )

        cost_of_goods: dict[Period, ResultsCostOfGoods] = {}
        purchases: dict[Period, int] = {}
        for period in periods:
            own = _cost_of_goods(grouped, period.start, period.end)
            cost_of_goods[period] = ResultsCostOfGoods(amount=own.amount, pending=own.pending)
            purchases[period] = _purchases_in(all_entries, period.start, period.end)

        return StockFiguresAnswer(
            rows=tuple(rows), cost_of_goods=cost_of_goods, purchases=purchases
        )
