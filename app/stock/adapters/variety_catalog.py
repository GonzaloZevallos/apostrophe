from sqlalchemy.orm import Session

from app.varieties.adapters.sql_varieties import SqlVarieties


class SqlVarietyCatalog:
    """`VarietyCatalog` over `SqlVarieties` (CODING_STANDARDS section 1: hexagons cross
    only through adapters). Built for one business."""

    def __init__(self, session: Session, business_id: int) -> None:
        self._varieties = SqlVarieties(session, business_id)

    def exists(self, variety_id: int) -> bool:
        return self._varieties.get(variety_id) is not None

    def ids(self) -> list[int]:
        # Archived varieties keep their stock rows' ids here; hiding them is the reader's job.
        ids = [variety.id for variety in (*self._varieties.listed(), *self._varieties.archived())]
        return [variety_id for variety_id in ids if variety_id is not None]
