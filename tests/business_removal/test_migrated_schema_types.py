"""The real migrated schema, over a file-backed SQLite database (`migrated.py`'s
own seam, not the in-memory one `test_migrated_schema.py` uses): today's database
must never trip `other_type_columns`, the guard a future column of an unwritable
type must fail at the diff that adds it, not at the operator's run.
"""

from __future__ import annotations

from pathlib import Path

from app.business_removal.domain.classification import other_type_columns
from tests.business_removal.migrated import migrated_schema


def test_no_other_typed_column_is_left_unexcluded(tmp_path: Path) -> None:
    schema = migrated_schema(tmp_path)

    assert other_type_columns(schema) == ()
