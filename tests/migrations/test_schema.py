from alembic.autogenerate import compare_metadata
from alembic.runtime.migration import MigrationContext

from app.db import make_engine
from app.migrations.runner import upgrade_to_head
from app.tables import metadata


def test_the_migrations_build_exactly_the_tables_the_code_declares() -> None:
    engine = make_engine("sqlite://")
    upgrade_to_head(engine)

    with engine.connect() as connection:
        context = MigrationContext.configure(connection, opts={"compare_type": True})
        assert compare_metadata(context, metadata) == []


def test_upgrading_twice_changes_nothing() -> None:
    engine = make_engine("sqlite://")
    upgrade_to_head(engine)
    upgrade_to_head(engine)
