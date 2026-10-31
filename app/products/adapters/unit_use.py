"""Implements units' `UnitUse` port: how many products of one business use a unit. Units
declares the port and never reads the product table; `app/main.py` wires this adapter in,
and neither side imports the other."""

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.products.adapters.tables import ProductRow


class SqlUnitUse:
    def __init__(self, session: Session, business_id: int) -> None:
        self._session = session
        self._business_id = business_id

    def products_using(self, unit_id: int) -> int:
        return self.products_per_unit().get(unit_id, 0)

    def products_per_unit(self) -> dict[int, int]:
        """Archived products count: they keep their unit."""
        statement = (
            select(ProductRow.unit_id, func.count())
            .where(ProductRow.business_id == self._business_id)
            .group_by(ProductRow.unit_id)
        )
        return {unit_id: count for unit_id, count in self._session.execute(statement)}
