"""Payments' half of the spreadsheet import's `PaymentsImport` port
(`app/spreadsheet_import/application/ports.py`): eligibility only. A payment is
written through `SalesImport.write_sale` (the sales adapter), never through this one —
`has_records` is the only method this port needs (ADR-0014).
"""

from __future__ import annotations

from sqlalchemy import exists, select
from sqlalchemy.orm import Session

from app.payments.adapters.tables import PaymentRow


class PaymentsImport:
    """Built for one business (ADR-0004): every statement filters on it."""

    def __init__(self, session: Session, business_id: int) -> None:
        self._session = session
        self._business_id = business_id

    def has_records(self) -> bool:
        """True for any payment row of this business, on-the-spot or later alike —
        the import's eligibility check never tells the two apart."""
        return bool(
            self._session.scalar(
                select(exists().where(PaymentRow.business_id == self._business_id))
            )
        )
