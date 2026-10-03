"""`SqlCatalogAttributes.put` is a single SQLite upsert on `(business_id, variety_id)`,
never a read followed by an insert (the plan's invariant): calling it twice for the
same variety must leave exactly one row, with the second call's values, never two.

A business and a variety are opened through the fixtures first, so the session itself
is still real; the attributes repository is then exercised directly, because this is a
repository seam test, not a behaviour test (CODING_STANDARDS §5's one agreed exception
for the catalog, per the plan).
"""

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from app.catalog.adapters.sql_attributes import SqlCatalogAttributes
from app.catalog.adapters.tables import CatalogAttributesRow
from app.catalog.domain.attributes import CatalogAttributes

# `client` opens the first (and, in these tests, only) business on a fresh engine.
BUSINESS_ID = 1


def _variety_id(client: TestClient) -> int:
    variety: int = client.post("/varieties", json={"name": "Upsert variety"}).json()["id"]
    return variety


def test_put_twice_for_the_same_variety_updates_in_place_with_no_duplicate_row(
    client: TestClient, engine: Engine
) -> None:
    variety_id = _variety_id(client)

    with Session(engine) as session:
        repo = SqlCatalogAttributes(session, BUSINESS_ID)
        repo.put(variety_id, CatalogAttributes.of(True, "🌿", 50, "cítrico"))
        repo.put(variety_id, CatalogAttributes.of(False, None, 100, None))
        session.commit()

    with Session(engine) as session:
        rows = session.scalars(
            select(CatalogAttributesRow).where(
                CatalogAttributesRow.business_id == BUSINESS_ID,
                CatalogAttributesRow.variety_id == variety_id,
            )
        ).all()
        assert len(rows) == 1
        assert rows[0].shown is False
        assert rows[0].emoji is None
        assert rows[0].indica_share == 100
        assert rows[0].aroma is None

        stored = SqlCatalogAttributes(session, BUSINESS_ID).all()[variety_id]
        assert stored.shown is False
        assert stored.indica_share is not None
        assert stored.indica_share.percent == 100


def test_a_variety_with_no_row_reads_as_the_default(client: TestClient, engine: Engine) -> None:
    variety_id = _variety_id(client)

    with Session(engine) as session:
        repo = SqlCatalogAttributes(session, BUSINESS_ID)

        assert variety_id not in repo.all()
