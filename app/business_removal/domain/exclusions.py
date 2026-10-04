"""The only business-owned names written by hand anywhere in this hexagon (the plan's
invariant): the platform tables, the tables skipped or withheld whole, and the columns
excluded from every export regardless of which table holds them.

Every other table and column the removal touches is found by reflecting the live
schema (`app/business_removal/domain/schema.py`), never listed here."""

from __future__ import annotations

# Tables with no `business_id` of their own (docs/adr/0004); the only tables a business
# row delete reaches by a column other than `business_id`.
PLATFORM_TABLES: frozenset[str] = frozenset({"business", "invitation", "login_guard"})

# Alembic's own bookkeeping table: never a business's data, never touched.
SKIPPED_TABLES: frozenset[str] = frozenset({"alembic_version"})

# Deleted along with the business, but never written to the export file.
WITHHELD_TABLES: frozenset[str] = frozenset({"invitation", "login_guard"})

# (table, column) pairs dropped from every exported row, even though their table is
# exported. Each future secret column joins this set in the diff that adds it.
EXCLUDED_COLUMNS: frozenset[tuple[str, str]] = frozenset({("app_user", "password_hash")})
