"""What the export file holds and how it is built (CONTEXT.md: Business export). No
database access: `build_document` turns rows already read into the one JSON-shaped
document, and never decides which rows those are (the plan's invariant).
"""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from datetime import date, datetime
from typing import Any

from app.business_removal.domain.exclusions import EXCLUDED_COLUMNS
from app.business_removal.domain.labels import (
    LABEL_AS_BUSINESS,
    LABEL_COLUMN,
    LABEL_VIA,
    exported_tables,
)
from app.business_removal.domain.schema import Schema, Table

HUNDREDTHS_SUFFIX = "_hundredths"


@dataclass(frozen=True)
class Business:
    """The one business this document is about. No other hexagon's `Business` is
    imported here (CODING_STANDARDS section 1): this is this hexagon's own, minimal
    view of it."""

    id: int
    name: str
    language: str

    def __post_init__(self) -> None:
        if not self.name:
            raise ValueError("a business needs a name")
        if not self.language:
            raise ValueError("a business needs a language")


class UnresolvableLabel(ValueError):
    """A row needed a label and `labels.py` declares none for its table. Reachable
    only if a run skips `unlabelled_tables` first; the fixed message names no data."""

    def __init__(self, table: str) -> None:
        super().__init__(f"table {table!r} has no declared label")


def build_document(
    business: Business,
    schema: Schema,
    rows: Mapping[str, Sequence[Mapping[str, Any]]],
    exported_at: datetime,
) -> dict[str, Any]:
    """`{"business": {"id", "name", "language"}, "exported_at", "kinds": {table: [records]}}`.
    Every owned table in `schema` becomes a kind, its records sorted by id, with
    `EXCLUDED_COLUMNS` dropped, `business_id` never repeated, foreign keys turned
    into `{"id", "name"}` references and `*_hundredths` integers into two-place
    decimal strings under the key without the suffix.

    `rows` may also carry withheld tables (`invitation`, `login_guard`, `reset_link`)
    the caller read for the delete but that never reach the document; those are never
    indexed here, since no exported table's foreign key ever targets one, and
    `login_guard` has no `id` column to index by."""
    owned = exported_tables(schema)
    rows_by_table: dict[str, dict[Any, Mapping[str, Any]]] = {
        name: {row["id"]: row for row in rows[name]} for name in owned if name in rows
    }
    kinds: dict[str, list[dict[str, Any]]] = {}
    for table_name in owned:
        table = schema.table(table_name)
        records = [
            _record(table, row, schema, rows_by_table, business.name)
            for row in rows.get(table_name, ())
        ]
        records.sort(key=lambda record: record["id"])
        kinds[table_name] = records
    return {
        "business": {
            "id": business.id,
            "name": business.name,
            "language": business.language,
        },
        "exported_at": _format_instant(exported_at),
        "kinds": kinds,
    }


def id_sets(document: Mapping[str, Any]) -> dict[str, frozenset[int]]:
    """The ids held by each kind of `document`, for comparing what was exported
    against what a delete reports back."""
    return {
        name: frozenset(record["id"] for record in records)
        for name, records in document["kinds"].items()
    }


def _record(
    table: Table,
    row: Mapping[str, Any],
    schema: Schema,
    rows_by_table: Mapping[str, Mapping[Any, Mapping[str, Any]]],
    business_name: str,
) -> dict[str, Any]:
    fk_targets = _foreign_key_targets(table)
    record: dict[str, Any] = {}
    for column in table.columns:
        name = column.name
        if name == "business_id":
            continue
        if (table.name, name) in EXCLUDED_COLUMNS:
            continue
        value = row[name]
        if name in fk_targets:
            record[name] = _reference(fk_targets[name], value, schema, rows_by_table, business_name)
        elif name.endswith(HUNDREDTHS_SUFFIX):
            record[name[: -len(HUNDREDTHS_SUFFIX)]] = _format_hundredths(value)
        elif isinstance(value, datetime):
            record[name] = _format_instant(value)
        elif isinstance(value, date):
            record[name] = value.isoformat()
        else:
            record[name] = value
    return record


def _foreign_key_targets(table: Table) -> dict[str, str]:
    """Every column of `table` that references another table, `business_id` aside --
    for the composite expense foreign key this is `category_id` alone, never
    `business_id` (the plan's invariant)."""
    targets: dict[str, str] = {}
    for foreign_key in table.foreign_keys:
        for column in foreign_key.columns:
            if column != "business_id":
                targets[column] = foreign_key.target_table
    return targets


def _reference(
    target_table: str,
    value: Any,
    schema: Schema,
    rows_by_table: Mapping[str, Mapping[Any, Mapping[str, Any]]],
    business_name: str,
) -> dict[str, Any] | None:
    if value is None:
        return None
    target_row = rows_by_table.get(target_table, {}).get(value)
    label = _label(target_table, target_row, schema, rows_by_table, business_name)
    return {"id": value, "name": label}


def _label(
    table_name: str,
    row: Mapping[str, Any] | None,
    schema: Schema,
    rows_by_table: Mapping[str, Mapping[Any, Mapping[str, Any]]],
    business_name: str,
) -> str:
    table = schema.table(table_name)
    if any(column.name == "name" for column in table.columns):
        assert row is not None
        return str(row["name"])
    if table_name in LABEL_AS_BUSINESS:
        return business_name
    if table_name in LABEL_COLUMN:
        assert row is not None
        return _format_label_value(row[LABEL_COLUMN[table_name]])
    if table_name in LABEL_VIA:
        assert row is not None
        via_column = LABEL_VIA[table_name]
        fk_targets = _foreign_key_targets(table)
        target_table = fk_targets[via_column]
        target_row = rows_by_table.get(target_table, {}).get(row[via_column])
        return _label(target_table, target_row, schema, rows_by_table, business_name)
    raise UnresolvableLabel(table_name)


def _format_label_value(value: Any) -> str:
    if isinstance(value, datetime):
        return _format_instant(value)
    if isinstance(value, date):
        return value.isoformat()
    return str(value)


def _format_instant(value: datetime) -> str:
    if value.tzinfo is not None:
        raise ValueError("instants are stored timezone-naive here")
    return value.isoformat() + "Z"


def _format_hundredths(value: int | None) -> str | None:
    """`value` hundredths as a two-place decimal string, from integers only -- never
    `float`, `round()` or `Decimal.quantize` (the plan's invariant)."""
    if value is None:
        return None
    sign = "-" if value < 0 else ""
    whole, remainder = divmod(abs(value), 100)
    return f"{sign}{whole}.{remainder:02d}"
