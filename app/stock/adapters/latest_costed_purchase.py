"""`LatestCostedPurchase`: the products port's reader of the Purchase that sets a variety's
cost (GH-522, ADR-0020). Built for one business. It filters and orders on the stored
columns and hands the use case the domain amount and the quantity; it never divides or
rounds."""

from __future__ import annotations

from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import domain_amount, money_scale_factor, scaled
from app.products.domain.cost_and_margins import CostedPurchase
from app.shared.quantity import Quantity
from app.stock.adapters.tables import StockEntryRow
from app.stock.domain.entry import Origin


class SqlLatestCostedPurchase:
    def __init__(self, session: Session, business_id: int) -> None:
        self._session = session
        self._business_id = business_id

    def latest_on(self, product_id: int, day: date) -> CostedPurchase | None:
        """The latest Purchase of the variety dated `day` or earlier with a cost above 0 and a
        quantity above 0: latest by date, then by when it was recorded, then by id."""
        factor = money_scale_factor(self._session, self._business_id)
        amount = scaled(StockEntryRow.total_cost, factor)
        statement = (
            select(amount, StockEntryRow.grams_hundredths)
            .where(
                StockEntryRow.business_id == self._business_id,
                StockEntryRow.variety_id == product_id,
                StockEntryRow.origin == Origin.PURCHASE.value,
                amount.is_not(None),
                amount > 0,
                StockEntryRow.grams_hundredths > 0,
                StockEntryRow.entered_on <= day,
            )
            .order_by(
                StockEntryRow.entered_on.desc(),
                StockEntryRow.recorded_at.desc(),
                StockEntryRow.id.desc(),
            )
            .limit(1)
        )
        found = self._session.execute(statement).first()
        if found is None:
            return None
        cost, hundredths = found
        assert cost is not None, "the select keeps only Purchases with a cost"
        return CostedPurchase(
            total_cost=domain_amount(self._session, self._business_id, cost),
            quantity=Quantity(hundredths=hundredths),
        )
