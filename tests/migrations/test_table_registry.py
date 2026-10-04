"""`app.tables` must register every migrated table on its own: a module missing from
`TABLE_MODULES` can still look registered inside the test suite, because some other
test's import already put it on the shared `Base.metadata` for the whole process. A
fresh interpreter that imports nothing but `app.tables` catches that (the plan's
registry-fix spec)."""

import ast
import subprocess
import sys

from sqlalchemy import text
from sqlalchemy.engine import Engine

from app.db import make_engine
from app.migrations.runner import upgrade_to_head

PRINT_REGISTERED_TABLES = "from app.tables import metadata; print(sorted(metadata.tables))"


def _migrated_table_names(engine: Engine) -> list[str]:
    with engine.connect() as connection:
        rows = connection.execute(text("SELECT name FROM sqlite_master WHERE type = 'table'"))
        return sorted(name for (name,) in rows if name != "alembic_version")


def test_every_migrated_table_is_registered_by_importing_app_tables_alone() -> None:
    engine = make_engine("sqlite://")
    upgrade_to_head(engine)
    migrated = _migrated_table_names(engine)

    result = subprocess.run(
        [sys.executable, "-c", PRINT_REGISTERED_TABLES],
        capture_output=True,
        text=True,
        check=True,
    )

    assert ast.literal_eval(result.stdout) == migrated
