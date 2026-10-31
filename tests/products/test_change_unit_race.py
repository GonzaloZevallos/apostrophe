"""A product's unit change and its race with a stock entry, over real SQLite files with two
connections, on both file drivers (docs/adr/0016): the guarded statement holds the whole
rule, so a partner's entry committed between the read and the write refuses the change."""

from collections.abc import Iterator
from datetime import UTC, date, datetime
from pathlib import Path

import pytest
from sqlalchemy import text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from app.db import make_engine
from app.migrations.runner import upgrade_to_head
from app.products.adapters.sql_products import SqlProducts
from app.products.application import manage_products
from app.products.application.errors import ProductUnitLocked
from app.products.domain.product import Product, ProductName
from app.shared.quantity import Quantity
from app.shared.unit import Unit
from app.stock.adapters.sql_stock_entries import SqlStockEntries
from app.stock.domain.entry import Origin, StockEntry

BUSINESS = 1
FINE = Unit(id=1, name="grams", label="g", decimals=2)
WHOLE = Unit(id=2, name="pieces", label="pc", decimals=0)


@pytest.fixture(params=["sqlite", "sqlite+libsql"])
def engine(request: pytest.FixtureRequest, tmp_path: Path) -> Iterator[Engine]:
    # No `importorskip`: a missing libsql driver fails here instead of passing as a skip.
    engine = make_engine(f"{request.param}:///{tmp_path / 'apostrophe.db'}")
    upgrade_to_head(engine)
    with engine.begin() as connection:
        connection.execute(
            text("INSERT INTO business (id, name, language) VALUES (1, 'Negocio', 'en')")
        )
        for unit in (FINE, WHOLE):
            connection.execute(
                text(
                    "INSERT INTO unit (id, business_id, name, name_key, label, decimals) "
                    "VALUES (:i, 1, :n, :n, :l, :d)"
                ),
                {"i": unit.id, "n": unit.name, "l": unit.label, "d": unit.decimals},
            )
    yield engine
    engine.dispose()


class _Units:
    """The units reader of the business: just the two units of the fixture."""

    def get(self, unit_id: int) -> Unit | None:
        return {FINE.id: FINE, WHOLE.id: WHOLE}.get(unit_id)

    def only_unit(self) -> Unit | None:
        return None

    def units_of(self, product_ids: object) -> dict[int, Unit]:
        raise AssertionError("changing a unit never reads another product's")


def _seed_product(engine: Engine) -> int:
    with Session(engine) as session:
        product = SqlProducts(session, BUSINESS).add(Product(ProductName.of("Gold"), FINE.id))
        session.commit()
        assert product.id is not None
        return product.id


def _unit_id_of(engine: Engine, product_id: int) -> int:
    with engine.connect() as connection:
        return int(
            connection.execute(
                text("SELECT unit_id FROM variety WHERE id = :i"), {"i": product_id}
            ).scalar_one()
        )


def _entry(product_id: int) -> StockEntry:
    now = datetime(2026, 10, 6, 12, tzinfo=UTC)
    return StockEntry(
        date(2026, 10, 6), product_id, Origin.HARVEST, Quantity.of("5"), None, None, now
    )


class _EntryLandsAfterTheRead(SqlProducts):
    """A partner's connection records an entry after this one read the product."""

    engine: Engine

    def get(self, product_id: int) -> Product | None:
        found = super().get(product_id)
        with Session(self.engine) as partner:
            SqlStockEntries(partner, BUSINESS).add(_entry(product_id))
            partner.commit()
        return found


def test_an_entry_recorded_between_the_read_and_the_write_locks_the_unit(engine: Engine) -> None:
    product_id = _seed_product(engine)
    _EntryLandsAfterTheRead.engine = engine

    with Session(engine) as session, pytest.raises(ProductUnitLocked):
        manage_products.change_product_unit(
            _EntryLandsAfterTheRead(session, BUSINESS), _Units(), session, product_id, WHOLE.id
        )

    assert _unit_id_of(engine, product_id) == FINE.id


def test_the_guarded_statement_reports_false_and_changes_nothing_for_another_business(
    engine: Engine,
) -> None:
    product_id = _seed_product(engine)
    with engine.begin() as connection:
        connection.execute(
            text("INSERT INTO business (id, name, language) VALUES (2, 'Otro', 'en')")
        )

    with Session(engine) as session:
        assert SqlProducts(session, 2).change_unit(product_id, WHOLE) is False
        session.commit()

    assert _unit_id_of(engine, product_id) == FINE.id


def test_the_guarded_statement_changes_a_product_with_no_history(engine: Engine) -> None:
    product_id = _seed_product(engine)

    with Session(engine) as session:
        assert SqlProducts(session, BUSINESS).change_unit(product_id, WHOLE) is True
        session.commit()

    assert _unit_id_of(engine, product_id) == WHOLE.id
