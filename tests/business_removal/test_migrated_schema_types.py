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


def test_variety_archived_at_is_exported_as_an_instant_with_no_secret_flag(
    tmp_path: Path,
) -> None:
    from app.business_removal.domain.classification import looks_secret, secret_columns

    schema = migrated_schema(tmp_path)

    [variety] = [table for table in schema.tables if table.name == "variety"]
    assert "archived_at" in [column.name for column in variety.columns]
    assert not looks_secret("archived_at")
    assert ("variety", "archived_at") not in secret_columns(schema)
    assert ("variety", "archived_at") not in other_type_columns(schema)
