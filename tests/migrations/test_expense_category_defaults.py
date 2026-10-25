"""An existing business gets the four default categories exactly once, when upgraded
past revision 0001 (PM, round 1): the upgrade must be safe to run again, and a default a
business later removes is never restored."""

from alembic import command
from alembic.config import Config
from sqlalchemy import select, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from app.db import make_engine
from app.expenses.adapters.tables import ExpenseCategoryRow
from app.migrations.runner import MIGRATIONS_ROOT, upgrade_to_head

DEFAULTS = ["Envíos y traslados", "Insumos de cultivo", "Otros", "Packaging"]


def _upgrade_to(engine: Engine, revision: str) -> None:
    with engine.connect() as connection:
        config = Config()
        config.set_main_option("script_location", str(MIGRATIONS_ROOT))
        config.attributes["connection"] = connection
        with connection.begin():
            command.upgrade(config, revision)


def _category_names(engine: Engine) -> list[str]:
    with Session(engine) as session:
        return sorted(row.name for row in session.scalars(select(ExpenseCategoryRow)))


def test_an_existing_business_gets_the_four_defaults_once_and_they_are_not_restored() -> None:
    engine = make_engine("sqlite://")
    _upgrade_to(engine, "0001")
    with Session(engine) as session:
        session.execute(text("INSERT INTO business (name) VALUES (:n)"), {"n": "Vieja Huerta"})
        session.commit()

    upgrade_to_head(engine)

    assert _category_names(engine) == DEFAULTS

    with Session(engine) as session:
        for row in session.scalars(select(ExpenseCategoryRow)):
            session.delete(row)
        session.commit()

    upgrade_to_head(engine)

    assert _category_names(engine) == []
