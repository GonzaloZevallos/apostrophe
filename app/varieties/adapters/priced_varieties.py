"""`SqlPricedVarieties`: results' `PricedVarieties` port
(`app/results/application/ports.py`), the checklist's price step and Hoy's "Arrancá por
las variedades" condition. One bounded `EXISTS` over the business's price entries whose
effective date is on or before `today`; a price dated later does not count yet. Built for
one business, wired onto `app.state.priced_varieties` in `app/main.py`.
"""

from __future__ import annotations

from datetime import date

from sqlalchemy import exists, select
from sqlalchemy.orm import Session

from app.varieties.adapters.tables import PriceEntryRow


class SqlPricedVarieties:
    def __init__(self, session: Session, business_id: int) -> None:
        self._session = session
        self._business_id = business_id

    def any_priced_on(self, today: date) -> bool:
        probe = select(
            exists().where(
                PriceEntryRow.business_id == self._business_id,
                PriceEntryRow.effective_from <= today,
            )
        )
        return bool(self._session.scalar(probe))
