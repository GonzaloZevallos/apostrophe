"""Every row says which business owns it (docs/adr/0004): every table carries a
non-null `business_id` pointing at `business`, except the platform tables that decide
who a request belongs to. A new table without it fails here before it holds a row."""

from app.tables import metadata

PLATFORM_TABLES = {"business", "invitation", "login_guard"}


def test_the_platform_tables_exist() -> None:
    assert PLATFORM_TABLES <= set(metadata.tables)


def test_every_other_table_names_the_business_that_owns_each_row() -> None:
    unowned = []
    for table in metadata.sorted_tables:
        if table.name in PLATFORM_TABLES:
            continue
        column = table.columns.get("business_id")
        owned = (
            column is not None
            and not column.nullable
            and any(fk.column.table.name == "business" for fk in column.foreign_keys)
        )
        if not owned:
            unowned.append(table.name)

    assert unowned == []
