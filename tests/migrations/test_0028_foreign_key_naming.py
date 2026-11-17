"""Migration 0028 (CODING_STANDARDS §11): `expense.category_id` becomes
`expense_category_id` and `reset_link.user_id` becomes `app_user_id`, with the foreign keys,
the unique constraint and the index that cover them renamed. Run through the real revisions
over a seeded file database, on the plain sqlite driver and on sqlite+libsql (ADR-0016):
every value survives under the new column names (judged by `comparator.compare`), the
structure differs from 0027's only in the renamed columns and the listed names, no
foreign key is left dangling, the repositories read the data back, and the walk down
restores the 0027 snapshot and reflection exactly."""

from __future__ import annotations

import re
from datetime import UTC, date, datetime, timedelta
from pathlib import Path
from typing import Any

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.accounts.adapters.sql_accounts import SqlAccounts
from app.db import make_engine
from app.expenses.adapters.sql_expense_categories import SqlExpenseCategories
from app.expenses.adapters.sql_expenses import SqlExpenses
from app.migrations.runner import MIGRATIONS_ROOT
from tests.migrations.comparator import Snapshot, compare, snapshot, upgrade_to

RENAMES = {
    ("expense", "category_id"): "expense_category_id",
    ("reset_link", "user_id"): "app_user_id",
}
# The only constraint and index names the revision changes.
NAME_PAIRS = {
    "ix_expense_business_id_category_id": "ix_expense_business_id_expense_category_id",
    "uq_reset_link_user_id": "uq_reset_link_app_user_id",
    "fk_reset_link_user_id_app_user": "fk_reset_link_app_user_id_app_user",
}
BARE_CATEGORY_ID = re.compile(r"(?<!expense_)category_id")
BARE_USER_ID = re.compile(r"(?<!app_)user_id")
DIGEST = "d" * 64
ISSUED_AT = datetime(2026, 10, 1, 12, 0, tzinfo=UTC)

# The plain driver raises `IntegrityError`; libsql raises a bare `ValueError` with the same text.
REFUSED = (IntegrityError, ValueError)

Structure = dict[str, dict[str, Any]]


def _migrate(engine: Engine, direction: str, revision: str) -> None:
    """As the runner does: foreign keys off while revisions run, checked after."""
    with engine.connect() as connection:
        config = Config()
        config.set_main_option("script_location", str(MIGRATIONS_ROOT))
        config.attributes["connection"] = connection
        raw = connection.connection.dbapi_connection
        assert raw is not None
        raw.execute("PRAGMA foreign_keys=OFF")
        with connection.begin():
            if direction == "up":
                command.upgrade(config, revision)
            else:
                command.downgrade(config, revision)
        assert raw.execute("PRAGMA foreign_key_check").fetchall() == []
        raw.execute("PRAGMA foreign_keys=ON")


def _seed(engine: Engine) -> None:
    """At 0027: two businesses, each with two expense categories, an expense on each and
    a user; the first user holds a live reset link."""
    with engine.begin() as connection:
        for business in (1, 2):
            connection.execute(
                text("INSERT INTO business (id, name, language) VALUES (:b, :name, 'en')"),
                {"b": business, "name": f"Negocio {business}"},
            )
            # The repositories read amounts through the business's money format.
            connection.execute(
                text(
                    "INSERT INTO money_format (business_id, symbol, decimals, scale) "
                    "VALUES (:b, '$', 0, 0)"
                ),
                {"b": business},
            )
            connection.execute(
                text(
                    "INSERT INTO app_user (id, business_id, email, password_hash) "
                    "VALUES (:id, :b, :email, 'x')"
                ),
                {"id": business, "b": business, "email": f"dueno{business}@example.com"},
            )
            for offset in (0, 1):
                category = business * 10 + offset
                connection.execute(
                    text(
                        "INSERT INTO expense_category (id, business_id, name, name_key) "
                        "VALUES (:id, :b, :name, :name)"
                    ),
                    {"id": category, "b": business, "name": f"Rubro {category}"},
                )
                connection.execute(
                    text(
                        "INSERT INTO expense (id, business_id, category_id, spent_on, amount, "
                        "detail, recorded_at) VALUES (:id, :b, :c, :on, :amount, :detail, "
                        "'2026-10-02 08:00:00.000000')"
                    ),
                    {
                        "id": category,
                        "b": business,
                        "c": category,
                        "on": f"2026-10-0{offset + 1}",
                        "amount": 1_000 + category,
                        "detail": f"compra {category}",
                    },
                )
        connection.execute(
            text(
                "INSERT INTO reset_link (id, business_id, user_id, token_digest, created_at) "
                "VALUES (1, 1, 1, :digest, '2026-10-01 12:00:00.000000')"
            ),
            {"digest": DIGEST},
        )


def _structure(engine: Engine) -> Structure:
    """Every table: columns with type, nullability and default, the primary key, the
    unique constraints, the indexes and the foreign keys with their ON DELETE, all
    names included."""
    inspector = inspect(engine)
    found: Structure = {}
    for table in inspector.get_table_names():
        found[table] = {
            "columns": [
                (c["name"], str(c["type"]), c["nullable"], str(c["default"]))
                for c in inspector.get_columns(table)
            ],
            "pk": (
                inspector.get_pk_constraint(table)["name"],
                inspector.get_pk_constraint(table)["constrained_columns"],
            ),
            "uniques": sorted(
                (str(u["name"]), u["column_names"]) for u in inspector.get_unique_constraints(table)
            ),
            "indexes": sorted(
                (str(i["name"]), i["column_names"], bool(i["unique"]))
                for i in inspector.get_indexes(table)
            ),
            "fks": sorted(
                (
                    str(fk["name"]),
                    fk["constrained_columns"],
                    fk["referred_table"],
                    fk["referred_columns"],
                    fk["options"].get("ondelete"),
                )
                for fk in inspector.get_foreign_keys(table)
            ),
        }
    return found


def _renamed_structure(before: Structure) -> Structure:
    """What 0027's structure must become: the two columns renamed wherever they appear,
    and the listed names swapped, nothing else."""

    def column(table: str, name: str) -> str:
        return RENAMES.get((table, name), name)

    def named(name: str) -> str:
        return NAME_PAIRS.get(name, name)

    renamed: Structure = {}
    for table, shape in before.items():
        renamed[table] = {
            "columns": [(column(table, n), *rest) for n, *rest in shape["columns"]],
            "pk": (shape["pk"][0], [column(table, c) for c in shape["pk"][1]]),
            "uniques": sorted(
                (named(n), [column(table, c) for c in cols]) for n, cols in shape["uniques"]
            ),
            "indexes": sorted(
                (named(n), [column(table, c) for c in cols], unique)
                for n, cols, unique in shape["indexes"]
            ),
            "fks": sorted(
                (
                    named(n),
                    [column(table, c) for c in cols],
                    referred,
                    [column(referred, c) for c in referred_cols],
                    ondelete,
                )
                for n, cols, referred, referred_cols, ondelete in shape["fks"]
            ),
        }
    return renamed


def _renamed(before: Snapshot) -> Snapshot:
    renamed: Snapshot = {}
    for table, rows in before.items():
        renamed[table] = {
            key: {RENAMES.get((table, column), column): value for column, value in row.items()}
            for key, row in rows.items()
        }
    return renamed


def _reflected_names(engine: Engine) -> list[str]:
    inspector = inspect(engine)
    names: list[str] = []
    for table in inspector.get_table_names():
        names.append(table)
        names += [column["name"] for column in inspector.get_columns(table)]
        names += [str(index["name"]) for index in inspector.get_indexes(table)]
        names += [str(u["name"]) for u in inspector.get_unique_constraints(table)]
        names += [str(fk["name"]) for fk in inspector.get_foreign_keys(table)]
        names.append(str(inspector.get_pk_constraint(table)["name"]))
    return names


def _expense_insert(engine: Engine, business: int, category: int, expense: int) -> None:
    with engine.begin() as connection:
        connection.execute(
            text(
                "INSERT INTO expense (id, business_id, expense_category_id, spent_on, amount, "
                "detail, recorded_at) VALUES (:id, :b, :c, '2026-10-03', 5, 'x', "
                "'2026-10-03 08:00:00.000000')"
            ),
            {"id": expense, "b": business, "c": category},
        )


def _round_trip(engine: Engine) -> None:
    upgrade_to(engine, "0027")
    _seed(engine)
    values_before = snapshot(engine)
    structure_before = _structure(engine)
    assert "category_id" in [c[0] for c in structure_before["expense"]["columns"]]

    _migrate(engine, "up", "0028")

    compare(_renamed(values_before), snapshot(engine))
    assert _structure(engine) == _renamed_structure(structure_before)
    names = _reflected_names(engine)
    assert [n for n in names if BARE_CATEGORY_ID.search(n) or BARE_USER_ID.search(n)] == []
    with engine.connect() as connection:
        assert connection.execute(text("PRAGMA foreign_key_check")).fetchall() == []

    with Session(engine) as session:
        expenses = SqlExpenses(session, 1)
        categories = SqlExpenseCategories(session, 1)
        assert [
            (e.id, e.category_id, e.amount, e.spent_on)
            for e in (expenses.by_id(10), expenses.by_id(11))
            if e is not None
        ] == [(10, 10, 1_010, date(2026, 10, 1)), (11, 11, 1_011, date(2026, 10, 2))]
        assert categories.count_filed_under(10) == 1
        assert categories.count_filed_under(20) == 0
        accounts = SqlAccounts(session)
        assert accounts.reset_link_is_live(DIGEST, ISSUED_AT - timedelta(days=1))
        assert not accounts.reset_link_is_live(DIGEST, ISSUED_AT + timedelta(days=1))

    with pytest.raises(REFUSED, match=r"UNIQUE constraint failed: reset_link\.token_digest"):
        with engine.begin() as connection:
            connection.execute(
                text(
                    "INSERT INTO reset_link (id, business_id, app_user_id, token_digest, "
                    "created_at) VALUES (2, 2, 2, :digest, '2026-10-01 12:00:00.000000')"
                ),
                {"digest": DIGEST},
            )
    with pytest.raises(REFUSED, match="FOREIGN KEY constraint failed"):
        _expense_insert(engine, business=1, category=20, expense=99)

    _migrate(engine, "down", "0027")

    compare(values_before, snapshot(engine))
    assert snapshot(engine).keys() == values_before.keys()
    assert _structure(engine) == structure_before
    with engine.connect() as connection:
        assert connection.execute(text("SELECT version_num FROM alembic_version")).all() == [
            ("0027",)
        ]


def test_it_renames_the_columns_and_walks_back_whole_on_plain_sqlite(tmp_path: Path) -> None:
    engine = make_engine(f"sqlite:///{tmp_path / 'apostrophe.db'}")
    _round_trip(engine)
    engine.dispose()


def test_it_renames_the_columns_and_walks_back_whole_on_libsql(tmp_path: Path) -> None:
    pytest.importorskip("sqlalchemy_libsql")
    engine = make_engine(f"sqlite+libsql:///{tmp_path / 'apostrophe.db'}")
    _round_trip(engine)
    engine.dispose()
