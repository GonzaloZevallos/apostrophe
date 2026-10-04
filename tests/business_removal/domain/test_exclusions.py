"""The exclusion sets are the only business-owned names written by hand in this hexagon
(the plan's invariant): everything else is discovered from the live schema elsewhere."""

from app.business_removal.domain.exclusions import (
    EXCLUDED_COLUMNS,
    PLATFORM_TABLES,
    SKIPPED_TABLES,
    WITHHELD_TABLES,
)


def test_the_withheld_tables_are_platform_tables() -> None:
    assert WITHHELD_TABLES <= PLATFORM_TABLES


def test_the_skipped_tables_are_not_platform_tables() -> None:
    assert SKIPPED_TABLES.isdisjoint(PLATFORM_TABLES)


def test_the_business_table_is_a_platform_table_but_never_withheld() -> None:
    assert "business" in PLATFORM_TABLES
    assert "business" not in WITHHELD_TABLES


def test_the_password_hash_column_is_excluded() -> None:
    assert ("app_user", "password_hash") in EXCLUDED_COLUMNS
