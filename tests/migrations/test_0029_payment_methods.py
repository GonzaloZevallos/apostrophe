"""0029 creates the `payment_method` table and writes no row, for an existing business or
a new one: the rows arrive in 0030 (docs/adr/0055). A name is unique within a business,
archived rows included, and two businesses may share one."""

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine
from sqlalchemy.exc import IntegrityError

from app.db import make_engine
from app.migrations.runner import MIGRATIONS_ROOT, upgrade_to_head


def _step(engine: Engine, action: str, revision: str) -> None:
    with engine.connect() as connection:
        config = Config()
        config.set_main_option("script_location", str(MIGRATIONS_ROOT))
        config.attributes["connection"] = connection
        with connection.begin():
            getattr(command, action)(config, revision)


def test_the_table_is_created_empty_for_a_business_that_already_exists() -> None:
    engine = make_engine("sqlite://")
    _step(engine, "upgrade", "0028")
    with engine.begin() as connection:
        connection.execute(text("INSERT INTO business (name, language) VALUES ('Old', 'en')"))

    _step(engine, "upgrade", "0029")

    with engine.connect() as connection:
        assert connection.execute(text("SELECT count(*) FROM payment_method")).scalar() == 0
        columns = {
            c["name"]: c["nullable"] for c in inspect(connection).get_columns("payment_method")
        }
    assert columns == {
        "id": False,
        "business_id": False,
        "name": False,
        "name_key": False,
        "icon": False,
        "position": False,
        "archived_at": True,
    }


def test_a_name_key_is_unique_within_a_business_but_not_across_businesses() -> None:
    engine = make_engine("sqlite://")
    upgrade_to_head(engine)
    insert = text(
        "INSERT INTO payment_method (business_id, name, name_key, icon, position)"
        " VALUES (:b, 'Cash', 'cash', 'coins', 1)"
    )
    with engine.begin() as connection:
        connection.execute(text("INSERT INTO business (id, name, language) VALUES (1,'A','en')"))
        connection.execute(text("INSERT INTO business (id, name, language) VALUES (2,'B','en')"))
        connection.execute(insert, {"b": 1})
        connection.execute(insert, {"b": 2})

    with pytest.raises(IntegrityError), engine.begin() as connection:
        connection.execute(insert, {"b": 1})


def test_the_downgrade_drops_the_table() -> None:
    engine = make_engine("sqlite://")
    upgrade_to_head(engine)

    _step(engine, "downgrade", "0028")

    assert "payment_method" not in inspect(engine).get_table_names()
