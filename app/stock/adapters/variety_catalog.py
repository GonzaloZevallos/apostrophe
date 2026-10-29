from sqlalchemy.orm import Session

from app.products.adapters.sql_products import SqlProducts


class SqlVarietyCatalog:
    """`VarietyCatalog` over `SqlVarieties` (CODING_STANDARDS section 1: hexagons cross
    only through adapters). Built for one business."""

    def __init__(self, session: Session, business_id: int) -> None:
        self._varieties = SqlProducts(session, business_id)

    def exists(self, variety_id: int) -> bool:
        return self._varieties.get(variety_id) is not None

    def usable(self, variety_id: int) -> bool:
        variety = self._varieties.get(variety_id)
        return variety is not None and not variety.is_archived

    def listed_ids(self) -> list[int]:
        ids = [variety.id for variety in self._varieties.listed()]
        return [variety_id for variety_id in ids if variety_id is not None]

    def archived_ids(self) -> list[int]:
        ids = [variety.id for variety in self._varieties.archived()]
        return [variety_id for variety_id in ids if variety_id is not None]

    def names(self) -> dict[int, str]:
        """Archived varieties included: a past withdrawal still names its variety."""
        every = [*self._varieties.listed(), *self._varieties.archived()]
        return {variety.id: variety.name.value for variety in every if variety.id is not None}
