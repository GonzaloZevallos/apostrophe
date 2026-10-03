"""`SqlLineCosts`: sales' `LineCosts` port (`app/sales/application/ports.py`),
implemented from stock's own data (ADR-0009). Sales never imports `app.stock`
(CODING_STANDARDS section 1); this adapter is the one place that import runs, wired
once onto `app.state.line_costs` in `app/main.py`.

This foundation slice answers every line as entirely pending: `allocate` and
`lots_and_draws` — the lot-order draw engine FIFO-costs a line against — are
stock-domain's files, not built here. The stock-api subtask replaces this method's
body with the real draw, without adding another `app/main.py` line (CODING_STANDARDS:
"only the foundation subtask adds ... an app/main.py line").
"""

from __future__ import annotations

from sqlalchemy.orm import Session

from app.sales.application.ports import LineCost
from app.sales.domain.sale import Sale


class SqlLineCosts:
    def __init__(self, session: Session, business_id: int) -> None:
        self._session = session
        self._business_id = business_id

    def for_sale(self, sale: Sale) -> list[LineCost]:
        return [LineCost(costed=None, pending_grams=line.grams) for line in sale.lines]
