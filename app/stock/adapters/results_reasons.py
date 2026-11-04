"""`WithdrawalReasons`: results' port for the business's reasons in list order
(`app/results/application/ports.py`), implemented over stock's own reason repository.
Results never imports `app.stock`; `app/main.py` wires this once onto
`app.state.results_withdrawal_reasons`. Built for one business."""

from __future__ import annotations

from collections.abc import Sequence

from sqlalchemy.orm import Session

from app.results.application.ports import WithdrawalReasons
from app.results.domain.ledger import ReasonRecord
from app.stock.adapters.sql_withdrawal_reasons import SqlWithdrawalReasons


class SqlResultsWithdrawalReasons(WithdrawalReasons):
    def __init__(self, session: Session, business_id: int) -> None:
        self._reasons = SqlWithdrawalReasons(session, business_id)

    def all(self) -> Sequence[ReasonRecord]:
        return [
            ReasonRecord(reason_id=r.id, name=r.name.value, position=r.position)
            for r in self._reasons.all()
        ]
