"""The migrated schema, reflected off a real file-backed SQLite database rather than
an in-memory one: `migrated_schema` runs `upgrade_to_head` on a fresh file under
`tmp_path` and returns what `SqlSchemaRows` reflects from it afterwards. Public so
more than one test module can share the same real-migration fixture (this subtask's
`test_migrated_schema_types.py`, and `test_migrated_schema.py`'s own tests).
"""

from __future__ import annotations

from pathlib import Path

from sqlalchemy.orm import Session

from app.business_removal.adapters.sql_schema_rows import SqlSchemaRows
from app.business_removal.domain.schema import Schema
from app.db import make_engine
from app.migrations.runner import upgrade_to_head


def migrated_schema(tmp_path: Path) -> Schema:
    db_path = tmp_path / "migrated.db"
    engine = make_engine(f"sqlite:///{db_path}")
    upgrade_to_head(engine)
    with Session(engine) as session:
        return SqlSchemaRows(session).schema()
