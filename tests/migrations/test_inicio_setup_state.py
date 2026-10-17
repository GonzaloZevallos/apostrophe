"""Migration 0012 creates `inicio_setup_state` and writes no row (ADR-0024; PRD "Businesses
that exist when this ships": no migration pre-writes a "gone" or "dismissed" fact), so a
business that already has data reaches the new table empty."""

from alembic import command
from alembic.config import Config
from sqlalchemy import text
from sqlalchemy.engine import Engine

from app.db import make_engine
from app.migrations.runner import MIGRATIONS_ROOT, upgrade_to_head


def _upgrade_to(engine: Engine, revision: str) -> None:
    with engine.connect() as connection:
        config = Config()
        config.set_main_option("script_location", str(MIGRATIONS_ROOT))
        config.attributes["connection"] = connection
        with connection.begin():
            command.upgrade(config, revision)


def test_upgrading_a_business_with_data_writes_no_setup_state_row() -> None:
    engine = make_engine("sqlite://")
    _upgrade_to(engine, "0011")
    with engine.begin() as connection:
        connection.execute(text("INSERT INTO business (id, name) VALUES (1, 'La Huerta')"))
        connection.execute(
            text(
                "INSERT INTO variety (id, business_id, name, name_key) "
                "VALUES (1, 1, 'Mango', 'mango')"
            )
        )

    upgrade_to_head(engine)

    with engine.connect() as connection:
        rows = connection.execute(text("SELECT COUNT(*) FROM inicio_setup_state")).scalar_one()
    assert rows == 0
    engine.dispose()
