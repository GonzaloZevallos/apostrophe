"""Migration 0021 (docs/adr/0055, 0056) through the real `upgrade_to_head` over a seeded
0019 database: one "grams" / "g" / 2 unit per business, every product linked to its own
business's unit, and not one value that existed before changed."""

from alembic import command
from alembic.config import Config
from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine

from app.db import make_engine
from app.migrations.runner import MIGRATIONS_ROOT, upgrade_to_head

UNTOUCHED = (
    "variety",
    "sale_line",
    "stock_entry",
    "stock_withdrawal_line",
    "price_entry",
    "stock_threshold",
)


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


def _exec(engine: Engine, statement: str, **params: object) -> None:
    with engine.begin() as connection:
        connection.execute(text(statement), params)


def _seed(engine: Engine) -> None:
    _exec(
        engine,
        "INSERT INTO business (id, name, language) "
        "VALUES (1, 'Uno', 'en'), (2, 'Dos', 'en'), (3, 'Vacio', 'en')",
    )
    for variety_id, business_id, name in ((1, 1, "Con"), (2, 1, "Sin"), (3, 2, "Otra")):
        _exec(
            engine,
            "INSERT INTO variety (id, business_id, name, name_key) "
            "VALUES (:id, :business_id, :name, :name)",
            id=variety_id,
            business_id=business_id,
            name=name,
        )
        _exec(
            engine,
            "INSERT INTO price_entry (id, business_id, variety_id, effective_from, "
            "list_price, bulk_price, bulk_minimum_hundredths) "
            "VALUES (:id, :business_id, :id, '2026-01-01', 1000, 800, 10000)",
            id=variety_id,
            business_id=business_id,
        )


def _seed_quantities(engine: Engine) -> None:
    """One row in every other table the migration must leave alone, so the comparison
    holds real values for all six."""
    _exec(
        engine,
        "INSERT INTO sale (id, business_id, sale_date, shipping_charged, recorded_at) "
        "VALUES (1, 1, '2026-01-02', 0, '2026-01-02 12:00:00')",
    )
    _exec(
        engine,
        "INSERT INTO sale_line (id, business_id, sale_id, variety_id, grams_hundredths, "
        "pricing_rule, price_per_gram, line_total, position) "
        "VALUES (1, 1, 1, 1, 1250, 'list', 1000, 12500, 0)",
    )
    _exec(
        engine,
        "INSERT INTO stock_entry (id, business_id, entry_date, variety_id, origin, "
        "grams_hundredths, total_cost, recorded_at) "
        "VALUES (1, 1, '2026-01-01', 1, 'harvest', 50000, 7000, '2026-01-01 12:00:00')",
    )
    _exec(
        engine,
        "INSERT INTO stock_withdrawal (id, business_id, reason, withdrawn_on, recorded_at) "
        "VALUES (1, 1, 'promotion', '2026-01-03', '2026-01-03 12:00:00')",
    )
    _exec(
        engine,
        "INSERT INTO stock_withdrawal_line (id, business_id, stock_withdrawal_id, variety_id, "
        "position, grams_hundredths) VALUES (1, 1, 1, 1, 0, 300)",
    )
    _exec(
        engine,
        "INSERT INTO stock_threshold (id, business_id, variety_id, threshold_hundredths) "
        "VALUES (1, 1, 1, 2500)",
    )


def _snapshot(
    engine: Engine, keep: dict[str, set[str]] | None = None
) -> dict[str, list[tuple[object, ...]]]:
    snapshot: dict[str, list[tuple[object, ...]]] = {}
    with engine.connect() as connection:
        for table in UNTOUCHED:
            columns = [column["name"] for column in inspect(connection).get_columns(table)]
            if keep is not None:
                columns = [name for name in columns if name in keep[table]]
            listed = ", ".join(columns)
            rows = connection.execute(text(f"SELECT {listed} FROM {table} ORDER BY 1")).all()
            snapshot[table] = [tuple(row) for row in rows]
    return snapshot


def _columns(engine: Engine) -> dict[str, set[str]]:
    with engine.connect() as connection:
        return {
            table: {column["name"] for column in inspect(connection).get_columns(table)}
            for table in UNTOUCHED
        }


def test_each_business_gets_one_grams_unit_and_every_value_that_existed_stays() -> None:
    engine = make_engine("sqlite://")
    _upgrade_to(engine, "0019")
    _seed(engine)
    _seed_quantities(engine)
    before = _snapshot(engine)
    assert all(before[table] for table in UNTOUCHED)
    columns_before = _columns(engine)

    upgrade_to_head(engine)

    assert _snapshot(engine, columns_before) == before
    with engine.connect() as connection:
        units = connection.execute(
            text("SELECT business_id, name, label, decimals FROM unit ORDER BY business_id")
        ).all()
        linked = connection.execute(
            text(
                "SELECT variety.business_id, unit.business_id FROM variety "
                "JOIN unit ON unit.id = variety.unit_id ORDER BY variety.id"
            )
        ).all()
    assert [tuple(unit) for unit in units] == [
        (1, "grams", "g", 2),
        (2, "grams", "g", 2),
        (3, "grams", "g", 2),
    ]
    assert [tuple(row) for row in linked] == [(1, 1), (1, 1), (2, 2)]


def test_the_downgrade_drops_the_unit_and_keeps_every_variety() -> None:
    engine = make_engine("sqlite://")
    _upgrade_to(engine, "0019")
    _seed(engine)
    _seed_quantities(engine)
    before = _snapshot(engine)
    assert all(before[table] for table in UNTOUCHED)
    upgrade_to_head(engine)

    _downgrade_to(engine, "0019")

    assert _snapshot(engine) == before
    with engine.connect() as connection:
        assert "unit" not in inspect(connection).get_table_names()
