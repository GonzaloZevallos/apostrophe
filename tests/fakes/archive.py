"""Archives a variety by writing its row directly: the archive route belongs to another
piece of the work, and a test of who reads or refuses an archived variety needs only the
stored fact (docs/adr/0031)."""

from datetime import UTC, datetime

from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from app.varieties.adapters.tables import VarietyRow


def archive_by_hand(engine: Engine, variety_id: int) -> None:
    with Session(engine) as session:
        row = session.get(VarietyRow, variety_id)
        assert row is not None
        row.archived_at = datetime(2026, 10, 6, tzinfo=UTC)
        session.commit()
