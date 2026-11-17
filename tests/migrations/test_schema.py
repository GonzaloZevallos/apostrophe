from alembic.autogenerate import compare_metadata
from alembic.runtime.migration import MigrationContext
from sqlalchemy import inspect

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


def test_a_payment_points_to_its_business_s_method_by_a_composite_key() -> None:
    engine = make_engine("sqlite://")
    upgrade_to_head(engine)

    inspector = inspect(engine)
    columns = {column["name"]: column for column in inspector.get_columns("payment")}
    assert columns["payment_method_id"]["nullable"] is False
    assert columns["method"]["nullable"] is True
    method_keys = [
        key
        for key in inspector.get_foreign_keys("payment")
        if key["referred_table"] == "payment_method"
    ]
    assert [(key["constrained_columns"], key["referred_columns"]) for key in method_keys] == [
        (["business_id", "payment_method_id"], ["business_id", "id"])
    ]
