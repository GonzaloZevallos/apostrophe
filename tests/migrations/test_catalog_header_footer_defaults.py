"""An existing business gets the literal default catalog header and footer exactly
once, when upgraded past revision 0005 (the plan's migration spec, following 0003's
sibling test for expense categories): the upgrade inserts no catalog attribute rows."""

from alembic import command
from alembic.config import Config
from sqlalchemy import select, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from app.catalog.adapters.tables import CatalogAttributesRow, CatalogHeaderFooterRow
from app.db import make_engine
from app.migrations.runner import MIGRATIONS_ROOT, upgrade_to_head

DEFAULT_HEADER = "\U0001f33f **CATÁLOGO** \U0001f33f"
DEFAULT_FOOTER = "\U0001f4e9 Consultas y pedidos por privado."


def _upgrade_to(engine: Engine, revision: str) -> None:
    with engine.connect() as connection:
        config = Config()
        config.set_main_option("script_location", str(MIGRATIONS_ROOT))
        config.attributes["connection"] = connection
        with connection.begin():
            command.upgrade(config, revision)


def test_an_existing_business_gets_the_default_header_and_footer_with_no_attribute_rows() -> None:
    engine = make_engine("sqlite://")
    _upgrade_to(engine, "0005")
    with Session(engine) as session:
        session.execute(text("INSERT INTO business (name) VALUES (:n)"), {"n": "Vieja Huerta"})
        session.execute(text("INSERT INTO business (name) VALUES (:n)"), {"n": "Otra Huerta"})
        session.commit()

    upgrade_to_head(engine)

    with Session(engine) as session:
        rows = session.scalars(select(CatalogHeaderFooterRow)).all()
        assert sorted((row.business_id, row.header, row.footer) for row in rows) == [
            (1, DEFAULT_HEADER, DEFAULT_FOOTER),
            (2, DEFAULT_HEADER, DEFAULT_FOOTER),
        ]
        assert session.scalars(select(CatalogAttributesRow)).all() == []
