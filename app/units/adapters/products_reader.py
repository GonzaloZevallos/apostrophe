"""Implements the one reader port each hexagon declares for a product's unit: products'
`UnitsReader`. The same SQL class serves every reader, a join from `variety.unit_id` to
`unit`, always for one business. `app/main.py` wires it; no reader imports this module."""

from collections.abc import Collection

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.products.adapters.tables import ProductRow
from app.shared.unit import Unit
from app.units.adapters.sql_units import unit_of
from app.units.adapters.tables import UnitRow


class SqlUnitsReader:
    def __init__(self, session: Session, business_id: int) -> None:
        self._session = session
        self._business_id = business_id

    def get(self, unit_id: int) -> Unit | None:
        statement = select(UnitRow).where(
            UnitRow.id == unit_id, UnitRow.business_id == self._business_id
        )
        row = self._session.scalar(statement)
        return None if row is None else unit_of(row)

    def only_unit(self) -> Unit | None:
        """The business's unit when it has exactly one, else `None`."""
        counted = self._session.scalar(
            select(func.count()).select_from(UnitRow).where(UnitRow.business_id == self._business_id)
        )
        if counted != 1:
            return None
        row = self._session.scalar(select(UnitRow).where(UnitRow.business_id == self._business_id))
        return None if row is None else unit_of(row)

    def units_of(self, product_ids: Collection[int]) -> dict[int, Unit]:
        if not product_ids:
            return {}
        statement = (
            select(ProductRow.id, UnitRow)
            .join(UnitRow, UnitRow.id == ProductRow.unit_id)
            .where(
                ProductRow.business_id == self._business_id,
                UnitRow.business_id == self._business_id,
                ProductRow.id.in_(product_ids),
            )
        )
        return {product_id: unit_of(row) for product_id, row in self._session.execute(statement)}
