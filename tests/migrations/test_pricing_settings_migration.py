"""Migration 0012 (docs/adr/0031) through the real `upgrade_to_head` over a seeded
0011 database: one settings row per existing business with both switches on, the VIP
price copied from the bulk price, every stored sale line untouched, and the 0
differences check for existing VIP pricing."""

from dataclasses import dataclass
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine
from sqlalchemy.exc import IntegrityError

from app.db import make_engine
from app.migrations.runner import MIGRATIONS_ROOT, upgrade_to_head

NOW = "2026-01-01 12:00:00"
LIST_PRICE = 1000
BULK_PRICE = 800
BULK_MINIMUM = 10000  # hundredths: 100 g
GRAMS_BELOW, GRAMS_AT, GRAMS_ABOVE = 5000, 10000, 20000


def _upgrade_to(engine: Engine, revision: str) -> None:
    with engine.connect() as connection:
        config = Config()
        config.set_main_option("script_location", str(MIGRATIONS_ROOT))
        config.attributes["connection"] = connection
        with connection.begin():
            command.upgrade(config, revision)


def _downgrade_to(engine: Engine, revision: str) -> None:
    with engine.connect() as connection:
        config = Config()
        config.set_main_option("script_location", str(MIGRATIONS_ROOT))
        config.attributes["connection"] = connection
        with connection.begin():
            command.downgrade(config, revision)


@dataclass(frozen=True)
class Outcome:
    rule: str
    price_per_gram: int
    total: int


def _total(price: int, grams_hundredths: int) -> int:
    return (price * grams_hundredths + 50) // 100


def _gift_or_special(gift: bool, special_price: int | None, grams: int) -> Outcome | None:
    """Both rules put a gift, then a special price, before every other rule."""
    if gift:
        return Outcome("gift", 0, 0)
    if special_price is not None:
        return Outcome("special", (200 * special_price + grams) // (2 * grams), special_price)
    return None


def _old_rule(
    *, vip: bool, bulk: int | None, grams: int, gift: bool = False, special_price: int | None = None
) -> Outcome:
    """The rule before this change, frozen here: a VIP customer with a bulk price pays
    it at any grams, stored VIP; otherwise bulk at or above the minimum; otherwise list."""
    first = _gift_or_special(gift, special_price, grams)
    if first is not None:
        return first
    if vip and bulk is not None:
        return Outcome("vip", bulk, _total(bulk, grams))
    if bulk is not None and grams >= BULK_MINIMUM:
        return Outcome("bulk", bulk, _total(bulk, grams))
    return Outcome("list", LIST_PRICE, _total(LIST_PRICE, grams))


def _new_rule_both_on(
    *,
    vip: bool,
    bulk: int | None,
    vip_price: int | None,
    grams: int,
    gift: bool = False,
    special_price: int | None = None,
) -> Outcome:
    """The rule of docs/adr/0031 with both switches on, written out as data: gift, then
    special price, then the lowest of list, bulk (at the minimum) and VIP (a VIP customer
    with a VIP price); a VIP-bulk tie is stored as VIP."""
    first = _gift_or_special(gift, special_price, grams)
    if first is not None:
        return first
    candidates: list[Outcome] = [Outcome("list", LIST_PRICE, _total(LIST_PRICE, grams))]
    if bulk is not None and grams >= BULK_MINIMUM:
        candidates.append(Outcome("bulk", bulk, _total(bulk, grams)))
    if vip and vip_price is not None:
        candidates.append(Outcome("vip", vip_price, _total(vip_price, grams)))
    lowest = min(candidate.price_per_gram for candidate in candidates)
    named = [c for c in candidates if c.price_per_gram == lowest]
    return next((c for c in named if c.rule == "vip"), named[0])


def _exec(engine: Engine, statement: str, **params: object) -> None:
    with engine.begin() as connection:
        connection.execute(text(statement), params)


def _seed(engine: Engine) -> None:
    """Two businesses. Business 1 has a variety with a bulk price (entry 1), one with
    no bulk price (entry 2); business 2 has one with a bulk price (entry 3). A sale
    line is stored against each, to prove no stored line moves."""
    _exec(engine, "INSERT INTO business (id, name) VALUES (1, 'Uno'), (2, 'Dos')")
    for variety_id, business_id, name in ((1, 1, "Con"), (2, 1, "Sin"), (3, 2, "Otra")):
        _exec(
            engine,
            "INSERT INTO variety (id, business_id, name, name_key) "
            "VALUES (:id, :business_id, :name, :name)",
            id=variety_id,
            business_id=business_id,
            name=name,
        )
    for entry_id, business_id, variety_id, bulk in (
        (1, 1, 1, BULK_PRICE),
        (2, 1, 2, None),
        (3, 2, 3, BULK_PRICE),
    ):
        _exec(
            engine,
            "INSERT INTO price_entry (id, business_id, variety_id, effective_from, "
            "list_price, bulk_price, bulk_minimum_hundredths) "
            "VALUES (:id, :business_id, :variety_id, '2026-01-01', :list_price, :bulk, :minimum)",
            id=entry_id,
            business_id=business_id,
            variety_id=variety_id,
            list_price=LIST_PRICE,
            bulk=bulk,
            minimum=BULK_MINIMUM if bulk is not None else None,
        )
    for customer_id, business_id in ((1, 1), (2, 2)):
        _exec(
            engine,
            "INSERT INTO customer (id, business_id, name, phone, vip) "
            "VALUES (:id, :business_id, 'C', NULL, 1)",
            id=customer_id,
            business_id=business_id,
        )
        _exec(
            engine,
            "INSERT INTO sale (id, business_id, sale_date, customer_id, shipping_charged, "
            "recorded_at) VALUES (:id, :business_id, '2026-01-01', :id, 0, :now)",
            id=customer_id,
            business_id=business_id,
            now=NOW,
        )
    for line_id, business_id, variety_id, rule, price in (
        (1, 1, 1, "vip", BULK_PRICE),
        (2, 1, 2, "list", LIST_PRICE),
        (3, 2, 3, "bulk", BULK_PRICE),
    ):
        _exec(
            engine,
            "INSERT INTO sale_line (id, business_id, sale_id, variety_id, grams_hundredths, "
            "pricing_rule, price_per_gram, line_total, position) "
            "VALUES (:id, :business_id, :sale_id, :variety_id, 5000, :rule, :price, "
            ":total, 0)",
            id=line_id,
            business_id=business_id,
            sale_id=1 if business_id == 1 else 2,
            variety_id=variety_id,
            rule=rule,
            price=price,
            total=_total(price, 5000),
        )


def _rows(engine: Engine, statement: str) -> list[tuple[object, ...]]:
    with engine.connect() as connection:
        return [tuple(row) for row in connection.execute(text(statement))]


def _migrate_seeded(tmp_path: Path) -> Engine:
    engine = make_engine(f"sqlite:///{tmp_path / 'apostrophe.db'}")
    _upgrade_to(engine, "0011")
    _seed(engine)
    return engine


def test_every_existing_business_gets_one_row_with_both_switches_on(tmp_path: Path) -> None:
    engine = _migrate_seeded(tmp_path)

    upgrade_to_head(engine)

    assert _rows(
        engine,
        "SELECT business_id, is_bulk_pricing, is_vip_customers FROM pricing_settings "
        "ORDER BY business_id",
    ) == [(1, 1, 1), (2, 1, 1)]
    engine.dispose()


def test_the_vip_price_copies_the_bulk_price_and_the_others_stay_null(tmp_path: Path) -> None:
    engine = _migrate_seeded(tmp_path)

    upgrade_to_head(engine)

    assert _rows(engine, "SELECT id, bulk_price, vip_price FROM price_entry ORDER BY id") == [
        (1, BULK_PRICE, BULK_PRICE),
        (2, None, None),
        (3, BULK_PRICE, BULK_PRICE),
    ]
    engine.dispose()


def test_stored_sale_lines_are_identical_before_and_after(tmp_path: Path) -> None:
    engine = _migrate_seeded(tmp_path)
    before = _rows(engine, "SELECT * FROM sale_line ORDER BY id")
    assert len(before) == 3

    upgrade_to_head(engine)

    assert _rows(engine, "SELECT * FROM sale_line ORDER BY id") == before
    engine.dispose()


@pytest.mark.parametrize("vip", [True, False])
@pytest.mark.parametrize("grams", [GRAMS_BELOW, GRAMS_AT, GRAMS_ABOVE])
@pytest.mark.parametrize("has_bulk", [True, False])
@pytest.mark.parametrize(
    ("gift", "special_price"),
    [(False, None), (True, None), (False, 600)],
    ids=["plain", "gift", "special"],
)
def test_an_existing_customer_pays_what_they_paid_before(
    tmp_path: Path,
    vip: bool,
    grams: int,
    has_bulk: bool,
    gift: bool,
    special_price: int | None,
) -> None:
    engine = _migrate_seeded(tmp_path)
    upgrade_to_head(engine)
    entry_id = 1 if has_bulk else 2
    [(bulk, vip_price)] = _rows(
        engine, f"SELECT bulk_price, vip_price FROM price_entry WHERE id = {entry_id}"
    )
    assert isinstance(bulk, int | None) and isinstance(vip_price, int | None)

    old = _old_rule(vip=vip, bulk=bulk, grams=grams, gift=gift, special_price=special_price)
    new = _new_rule_both_on(
        vip=vip,
        bulk=bulk,
        vip_price=vip_price,
        grams=grams,
        gift=gift,
        special_price=special_price,
    )

    assert new == old
    engine.dispose()


def test_the_matrix_checker_rejects_a_changed_rule() -> None:
    # The comparison above must be able to fail: a VIP price above the bulk price (what a
    # seller may set later) is a different outcome from the frozen old rule.
    old = _old_rule(vip=True, bulk=BULK_PRICE, grams=GRAMS_ABOVE)
    changed = _new_rule_both_on(
        vip=True, bulk=BULK_PRICE, vip_price=BULK_PRICE + 50, grams=GRAMS_ABOVE
    )

    assert changed != old


def test_a_raw_insert_without_a_vip_price_succeeds_and_reads_back_null(tmp_path: Path) -> None:
    engine = make_engine(f"sqlite:///{tmp_path / 'apostrophe.db'}")
    upgrade_to_head(engine)
    _exec(engine, "INSERT INTO business (id, name) VALUES (1, 'Uno')")
    _exec(engine, "INSERT INTO variety (id, business_id, name, name_key) VALUES (1, 1, 'V', 'v')")

    _exec(
        engine,
        "INSERT INTO price_entry (id, business_id, variety_id, effective_from, list_price) "
        "VALUES (1, 1, 1, '2026-01-01', 500)",
    )

    assert _rows(engine, "SELECT vip_price FROM price_entry") == [(None,)]
    engine.dispose()


def test_a_business_cannot_have_two_settings_rows(tmp_path: Path) -> None:
    engine = make_engine(f"sqlite:///{tmp_path / 'apostrophe.db'}")
    upgrade_to_head(engine)
    _exec(engine, "INSERT INTO business (id, name) VALUES (1, 'Uno')")
    insert = (
        "INSERT INTO pricing_settings (business_id, is_bulk_pricing, is_vip_customers) "
        "VALUES (1, 0, 0)"
    )
    _exec(engine, insert)

    with pytest.raises(IntegrityError):
        _exec(engine, insert)
    engine.dispose()


def test_the_downgrade_drops_the_table_and_the_column(tmp_path: Path) -> None:
    engine = _migrate_seeded(tmp_path)
    upgrade_to_head(engine)

    _downgrade_to(engine, "0011")

    inspector = inspect(engine)
    assert "pricing_settings" not in inspector.get_table_names()
    assert "vip_price" not in [c["name"] for c in inspector.get_columns("price_entry")]
    assert _rows(engine, "SELECT id, bulk_price FROM price_entry ORDER BY id") == [
        (1, BULK_PRICE),
        (2, None),
        (3, BULK_PRICE),
    ]
    engine.dispose()


def test_it_runs_over_libsql_too(tmp_path: Path) -> None:
    pytest.importorskip("sqlalchemy_libsql")
    engine = make_engine(f"sqlite+libsql:///{tmp_path / 'apostrophe.db'}")
    _upgrade_to(engine, "0011")
    _seed(engine)

    upgrade_to_head(engine)

    assert _rows(engine, "SELECT id, vip_price FROM price_entry ORDER BY id") == [
        (1, BULK_PRICE),
        (2, None),
        (3, BULK_PRICE),
    ]
    assert _rows(engine, "SELECT COUNT(*) FROM pricing_settings") == [(2,)]
    engine.dispose()
