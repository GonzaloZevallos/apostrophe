"""The guarded delete and its race with a sale or an entry, over real SQLite files, with
two connections, on both file drivers (docs/adr/0016): plain `sqlite:///` and
`sqlite+libsql:///`. An in-memory database cannot hold two connections, so these are the
only tests where the foreign keys and the guarded statement meet a real concurrent writer."""

from collections.abc import Iterator
from datetime import UTC, date, datetime
from pathlib import Path

import pytest
from sqlalchemy import text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from app.catalog.adapters.leaving import SqlCatalogLeaving
from app.catalog.adapters.sql_attributes import SqlCatalogAttributes
from app.catalog.domain.attributes import CatalogAttributes
from app.db import make_engine
from app.migrations.runner import upgrade_to_head
from app.products.adapters.sql_products import SqlProducts
from app.products.application import manage_prices, manage_products
from app.products.application.errors import ProductHasHistory, ProductNotFound
from app.products.domain.product import PriceEntry, Product, ProductName
from app.sales.adapters.customer_facts import SqlCustomerFacts
from app.sales.adapters.price_book import SqlPriceBook
from app.sales.adapters.sql_sales import SqlSales
from app.sales.application.record_sale import LineInput, record_sale
from app.sales.domain.pricing import VarietyPricing
from app.sales.domain.sale import UnknownVariety
from app.shared.pricing_settings import PricingSettings
from app.shared.quantity import Quantity
from app.stock.adapters.leaving import SqlStockLeaving
from app.stock.adapters.sql_stock_entries import SqlStockEntries
from app.stock.adapters.sql_thresholds import SqlThresholds
from app.stock.adapters.variety_catalog import SqlVarietyCatalog
from app.stock.application import manage_entries
from app.stock.application.errors import VarietyNotFound as StockVarietyNotFound
from app.stock.domain.entry import Origin, StockEntry
from app.stock.domain.threshold import Threshold

DAY = date(2026, 10, 6)
NOW = datetime(2026, 10, 6, 12, tzinfo=UTC)
BUSINESS = 1
DEPENDENTS = ("price_entry", "stock_entry", "stock_threshold", "catalog_attributes", "sale_line")


@pytest.fixture(params=["sqlite", "sqlite+libsql"])
def engine(request: pytest.FixtureRequest, tmp_path: Path) -> Iterator[Engine]:
    # No `importorskip`: a missing libsql driver fails here instead of passing as a skip.
    engine = make_engine(f"{request.param}:///{tmp_path / 'apostrophe.db'}")
    upgrade_to_head(engine)
    with engine.begin() as connection:
        connection.execute(
            text("INSERT INTO business (id, name, language) VALUES (1, 'Negocio', 'en')")
        )
    yield engine
    engine.dispose()


class BothRulesOn:
    """The pricing switches, both on: the rule the refusal under test never reads."""

    def current(self) -> PricingSettings:
        return PricingSettings(is_bulk_pricing=True, is_vip_customers=True)


def _seed_variety(engine: Engine) -> int:
    """A variety with a price entry, a threshold and catalog attributes, and no history."""
    with Session(engine) as session:
        variety = SqlProducts(session, BUSINESS).add(Product(ProductName.of("Gold")))
        assert variety.id is not None
        variety.record_price(PriceEntry.of(date(2026, 1, 1), 10_000))
        SqlProducts(session, BUSINESS).save(variety)
        SqlThresholds(session, BUSINESS).set(variety.id, Threshold(Quantity.of("5")))
        attributes = CatalogAttributes.of(shown=True, emoji=None, indica_share=50, aroma="dulce")
        SqlCatalogAttributes(session, BUSINESS).put(variety.id, attributes)
        session.commit()
        return variety.id


def _entry(variety_id: int) -> StockEntry:
    return StockEntry(DAY, variety_id, Origin.HARVEST, Quantity.of("5"), None, None, NOW)


def _count(engine: Engine, table: str) -> int:
    with engine.connect() as connection:
        return int(connection.execute(text(f"SELECT count(*) FROM {table}")).scalar_one())


def _orphans(engine: Engine) -> int:
    with engine.connect() as connection:
        return sum(
            int(
                connection.execute(
                    text(
                        f"SELECT count(*) FROM {table} "
                        "WHERE variety_id NOT IN (SELECT id FROM variety)"
                    )
                ).scalar_one()
            )
            for table in DEPENDENTS
        )


def _delete(engine: Engine, variety_id: int, varieties_class: type[SqlProducts]) -> None:
    with Session(engine) as session:
        manage_products.delete_product(
            varieties_class(session, BUSINESS),
            _Leaving(session),
            session,
            variety_id,
        )


class _Leaving:
    def __init__(self, session: Session) -> None:
        self._parts = (SqlStockLeaving(session, BUSINESS), SqlCatalogLeaving(session, BUSINESS))

    def leaving(self, variety_id: int) -> None:
        for part in self._parts:
            part.leaving(variety_id)


def test_remove_unused_removes_a_variety_with_no_history_and_returns_its_id(
    engine: Engine,
) -> None:
    variety_id = _seed_variety(engine)

    with Session(engine) as session:
        varieties = SqlProducts(session, BUSINESS)
        assert varieties.has_history(variety_id) is False
        _Leaving(session).leaving(variety_id)
        varieties.remove_price_entries(variety_id)
        assert varieties.remove_unused(variety_id) is True
        session.commit()

    assert _count(engine, "variety") == 0
    assert [_count(engine, table) for table in DEPENDENTS] == [0, 0, 0, 0, 0]


def test_remove_unused_removes_nothing_from_a_variety_with_history(engine: Engine) -> None:
    variety_id = _seed_variety(engine)
    with Session(engine) as session:
        SqlStockEntries(session, BUSINESS).add(_entry(variety_id))
        session.commit()

    with Session(engine) as session:
        varieties = SqlProducts(session, BUSINESS)
        assert varieties.has_history(variety_id) is True
        assert varieties.remove_unused(variety_id) is False
        session.commit()

    assert _count(engine, "variety") == 1


def test_a_variety_of_another_business_is_never_removed(engine: Engine) -> None:
    variety_id = _seed_variety(engine)
    with engine.begin() as connection:
        connection.execute(
            text("INSERT INTO business (id, name, language) VALUES (2, 'Otro', 'en')")
        )

    with Session(engine) as session:
        assert SqlProducts(session, 2).remove_unused(variety_id) is False
        session.commit()

    assert _count(engine, "variety") == 1


def test_a_rollback_after_the_dependent_deletes_keeps_every_dependent(engine: Engine) -> None:
    variety_id = _seed_variety(engine)

    with Session(engine) as session:
        _Leaving(session).leaving(variety_id)
        SqlProducts(session, BUSINESS).remove_price_entries(variety_id)
        session.rollback()

    assert _count(engine, "variety") == 1
    assert [
        _count(engine, t) for t in ("price_entry", "stock_threshold", "catalog_attributes")
    ] == [
        1,
        1,
        1,
    ]


class _GuardLosesTheRace(SqlProducts):
    """The guarded delete finds a history that appeared after the first check."""

    def remove_unused(self, variety_id: int) -> bool:
        super().remove_unused(variety_id)
        return False


def test_delete_variety_rolls_back_the_dependents_when_the_guarded_delete_removes_nothing(
    engine: Engine,
) -> None:
    variety_id = _seed_variety(engine)

    with pytest.raises(ProductHasHistory):
        _delete(engine, variety_id, _GuardLosesTheRace)

    assert _count(engine, "variety") == 1
    assert [
        _count(engine, t) for t in ("price_entry", "stock_threshold", "catalog_attributes")
    ] == [
        1,
        1,
        1,
    ]


class _EntryLandsAfterTheHistoryCheck(SqlProducts):
    """A partner's connection records an entry after this one found no history."""

    engine: Engine

    def has_history(self, variety_id: int) -> bool:
        found = super().has_history(variety_id)
        with Session(self.engine) as partner:
            SqlStockEntries(partner, BUSINESS).add(_entry(variety_id))
            partner.commit()
        return found


def test_an_entry_recorded_first_makes_the_delete_answer_has_history(engine: Engine) -> None:
    variety_id = _seed_variety(engine)
    _EntryLandsAfterTheHistoryCheck.engine = engine

    with pytest.raises(ProductHasHistory):
        _delete(engine, variety_id, _EntryLandsAfterTheHistoryCheck)

    assert _count(engine, "variety") == 1
    assert _count(engine, "stock_entry") == 1
    assert [
        _count(engine, t) for t in ("price_entry", "stock_threshold", "catalog_attributes")
    ] == [
        1,
        1,
        1,
    ]
    assert _orphans(engine) == 0


class _StaleCatalog:
    """The request's own check ran before the partner's delete: it says the variety is
    usable once, then answers from the real tables."""

    def __init__(self, real: SqlVarietyCatalog) -> None:
        self._real = real
        self._stale_exists = True
        self._stale_usable = True

    def exists(self, variety_id: int) -> bool:
        if self._stale_exists:
            self._stale_exists = False
            return True
        return self._real.exists(variety_id)

    def usable(self, variety_id: int) -> bool:
        if self._stale_usable:
            self._stale_usable = False
            return True
        return self._real.usable(variety_id)

    def archived_ids(self) -> list[int]:
        return self._real.archived_ids()

    def listed_ids(self) -> list[int]:
        return self._real.listed_ids()

    def names(self) -> dict[int, str]:
        return self._real.names()


def test_a_delete_committed_first_makes_the_entry_answer_gone_and_orphans_nothing(
    engine: Engine,
) -> None:
    variety_id = _seed_variety(engine)

    with Session(engine) as late:
        _delete(engine, variety_id, SqlProducts)

        with pytest.raises(StockVarietyNotFound):
            manage_entries.record_entry(
                SqlStockEntries(late, BUSINESS),
                _StaleCatalog(SqlVarietyCatalog(late, BUSINESS)),
                late,
                entry_date=DAY,
                variety_id=variety_id,
                origin=Origin.HARVEST,
                quantity=Quantity.of("5"),
                total_cost=None,
                note=None,
                today=DAY,
                recorded_at=NOW,
            )

    assert _count(engine, "stock_entry") == 0
    assert _orphans(engine) == 0


def test_a_delete_committed_first_makes_the_price_answer_gone(engine: Engine) -> None:
    variety_id = _seed_variety(engine)

    with Session(engine) as late:
        varieties = SqlProducts(late, BUSINESS)
        stale = varieties.get(variety_id)
        assert stale is not None
        _delete(engine, variety_id, SqlProducts)

        with pytest.raises(ProductNotFound):
            manage_prices.record_price_entry(
                _ReadsStaleOnce(late, stale),
                BothRulesOn(),
                late,
                variety_id,
                effective_from=date(2026, 2, 1),
                list_price=12_000,
            )

    assert _count(engine, "price_entry") == 0
    assert _orphans(engine) == 0


class _ReadsStaleOnce(SqlProducts):
    """The first read is the one the request made before the partner's delete."""

    def __init__(self, session: Session, stale: Product) -> None:
        super().__init__(session, BUSINESS)
        self._stale: Product | None = stale

    def get(self, variety_id: int) -> Product | None:
        stale, self._stale = self._stale, None
        return stale if stale is not None else super().get(variety_id)


def _record_sale(session: Session, price_book: SqlPriceBook, variety_id: int) -> None:
    record_sale(
        SqlSales(session, BUSINESS),
        price_book,
        SqlCustomerFacts(session, BUSINESS),
        BothRulesOn(),
        session,
        sale_date=DAY,
        today=DAY,
        customer_id=None,
        shipping_charged=0,
        note=None,
        lines=[LineInput(variety_id=variety_id, quantity=Quantity.of("1"), gift=True)],
        method=None,
        left_owing=False,
        recorded_at=NOW,
    )


class _PricesStaleOnce(SqlPriceBook):
    """The first lookup is the one the request made before the partner's delete."""

    def __init__(self, session: Session, stale: VarietyPricing) -> None:
        super().__init__(session, BUSINESS)
        self._stale: VarietyPricing | None = stale

    def for_variety(self, variety_id: int, day: date) -> VarietyPricing | None:
        stale, self._stale = self._stale, None
        return stale if stale is not None else super().for_variety(variety_id, day)


class _SaleLandsAfterTheHistoryCheck(SqlProducts):
    """A partner's connection records a sale after this one found no history."""

    engine: Engine

    def has_history(self, variety_id: int) -> bool:
        found = super().has_history(variety_id)
        with Session(self.engine) as partner:
            _record_sale(partner, SqlPriceBook(partner, BUSINESS), variety_id)
        return found


def test_a_sale_recorded_first_makes_the_delete_answer_has_history(engine: Engine) -> None:
    variety_id = _seed_variety(engine)
    _SaleLandsAfterTheHistoryCheck.engine = engine

    with pytest.raises(ProductHasHistory):
        _delete(engine, variety_id, _SaleLandsAfterTheHistoryCheck)

    assert _count(engine, "variety") == 1
    assert _count(engine, "sale_line") == 1
    assert [
        _count(engine, t) for t in ("price_entry", "stock_threshold", "catalog_attributes")
    ] == [
        1,
        1,
        1,
    ]
    assert _orphans(engine) == 0


def test_a_delete_committed_first_makes_the_sale_answer_gone_and_orphans_nothing(
    engine: Engine,
) -> None:
    variety_id = _seed_variety(engine)

    with Session(engine) as late:
        stale = SqlPriceBook(late, BUSINESS).for_variety(variety_id, DAY)
        assert stale is not None
        _delete(engine, variety_id, SqlProducts)

        with pytest.raises(UnknownVariety):
            _record_sale(late, _PricesStaleOnce(late, stale), variety_id)

    assert _count(engine, "sale") == 0
    assert _count(engine, "sale_line") == 0
    assert _orphans(engine) == 0
