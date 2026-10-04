"""How a row that has no `name` column of its own is named when something else
refers to it (the plan's invariant: every reference carries a name and an id). The
only business-owned names written by hand here, alongside `exclusions.py`: a table
added later with a `name` column needs nothing; one without must be added to one of
these three maps or `unlabelled_tables` refuses it.
"""

from __future__ import annotations

from app.business_removal.domain.exclusions import PLATFORM_TABLES, SKIPPED_TABLES
from app.business_removal.domain.schema import Schema

# table -> one of its own columns, used as the label when the table has no `name`.
LABEL_COLUMN: dict[str, str] = {
    "sale": "sale_date",
    "payment": "paid_on",
    "stock_entry": "entry_date",
    "price_entry": "effective_from",
    "expense": "spent_on",
    "app_user": "email",
}

# table -> the foreign-key column whose target's label (recursively) names this row.
LABEL_VIA: dict[str, str] = {
    "sale_line": "variety_id",
    "catalog_attributes": "variety_id",
    "stock_threshold": "variety_id",
}

# Tables with exactly one row per business and nothing of their own worth naming: the
# business's own name stands in for them.
LABEL_AS_BUSINESS: frozenset[str] = frozenset({"catalog_header_footer"})


def owned_tables(schema: Schema) -> tuple[str, ...]:
    """Every table in `schema` except the platform and skipped tables: the ones the
    removal exports and deletes by `business_id`."""
    return tuple(
        table.name
        for table in schema.tables
        if table.name not in PLATFORM_TABLES and table.name not in SKIPPED_TABLES
    )


def unlabelled_tables(schema: Schema) -> frozenset[str]:
    """Owned tables with neither a `name` column nor a declared label. Any result
    means the removal must refuse rather than export a row nothing can name."""
    unlabelled = set()
    for name in owned_tables(schema):
        table = schema.table(name)
        has_name_column = any(column.name == "name" for column in table.columns)
        is_declared = name in LABEL_COLUMN or name in LABEL_VIA or name in LABEL_AS_BUSINESS
        if not has_name_column and not is_declared:
            unlabelled.add(name)
    return frozenset(unlabelled)
