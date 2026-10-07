"""How a row that has no `name` column of its own is named when something else
refers to it (the plan's invariant: every reference carries a name and an id). The
only business-owned names written by hand here, alongside `exclusions.py`: a table
added later with a `name` column needs nothing; one without must be added to one of
these three maps or `unlabelled_tables` refuses it.
"""

from __future__ import annotations

from app.business_removal.domain.exclusions import (
    BUSINESS_TABLE,
    PLATFORM_TABLES,
    SKIPPED_TABLES,
    WITHHELD_TABLES,
)
from app.business_removal.domain.schema import Schema

# table -> one of its own columns, used as the label when the table has no `name`.
LABEL_COLUMN: dict[str, str] = {
    "sale": "sale_date",
    "payment": "paid_on",
    "stock_entry": "entry_date",
    "stock_withdrawal": "withdrawn_on",
    "price_entry": "effective_from",
    "expense": "spent_on",
    "app_user": "email",
}

# table -> the foreign-key column whose target's label (recursively) names this row.
LABEL_VIA: dict[str, str] = {
    "sale_line": "variety_id",
    "catalog_attributes": "variety_id",
    "stock_threshold": "variety_id",
    "stock_withdrawal_line": "variety_id",
}

# Tables with exactly one row per business and nothing of their own worth naming: the
# business's own name stands in for them.
LABEL_AS_BUSINESS: frozenset[str] = frozenset(
    {"catalog_header_footer", "pinned_catalog", "pricing_settings"}
)


def owned_tables(schema: Schema) -> tuple[str, ...]:
    """Every table in `schema` except the platform and skipped tables: the ones the
    removal deletes by `business_id` (`WITHHELD_TABLES` included -- a withheld table
    is still deleted, just never exported; see `exported_tables`)."""
    return tuple(
        table.name
        for table in schema.tables
        if table.name not in PLATFORM_TABLES and table.name not in SKIPPED_TABLES
    )


def exported_tables(schema: Schema) -> tuple[str, ...]:
    """`owned_tables` minus `WITHHELD_TABLES` (docs/adr/0019): the ones the export,
    the dry run's exported lines, reconciliation, `unlabelled_tables` and the
    reference index all iterate -- never a withheld table, deleted but never written
    to the export file."""
    return tuple(name for name in owned_tables(schema) if name not in WITHHELD_TABLES)


def tables_written(schema: Schema) -> tuple[str, ...]:
    """Every table whose rows actually land in the export file: `exported_tables`
    plus `business` itself, which the document carries as its own header rather than
    as a "kind" (docs/adr/0019). `secret_columns` checks exactly this set."""
    return (*exported_tables(schema), BUSINESS_TABLE)


def unlabelled_tables(schema: Schema) -> frozenset[str]:
    """Exported tables with neither a `name` column nor a declared label. Any result
    means the removal must refuse rather than export a row nothing can name -- a
    withheld table never needs a label, since it is never exported."""
    unlabelled = set()
    for name in exported_tables(schema):
        table = schema.table(name)
        has_name_column = any(column.name == "name" for column in table.columns)
        is_declared = name in LABEL_COLUMN or name in LABEL_VIA or name in LABEL_AS_BUSINESS
        if not has_name_column and not is_declared:
            unlabelled.add(name)
    return frozenset(unlabelled)
