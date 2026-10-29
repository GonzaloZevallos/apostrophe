"""Archives a variety without a client in hand: through the domain's own `archive` and the
real repository, the code the archive route runs, so a test of who reads or refuses an
archived variety needs only the stored fact (docs/adr/0032)."""

from datetime import UTC, datetime

from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from app.products.adapters.sql_products import SqlProducts
from app.products.adapters.tables import ProductRow


def archive_by_hand(engine: Engine, variety_id: int) -> None:
    with Session(engine) as session:
        row = session.get(ProductRow, variety_id)
        assert row is not None
        varieties = SqlProducts(session, row.business_id)
        variety = varieties.get(variety_id)
        assert variety is not None
        variety.archive(datetime(2026, 10, 6, tzinfo=UTC))
        varieties.save(variety)
        session.commit()
