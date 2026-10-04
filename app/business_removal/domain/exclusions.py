"""The only business-owned names written by hand anywhere in this hexagon (the plan's
invariant): the platform tables, the tables skipped or withheld whole, and the columns
excluded from every export regardless of which table holds them.

Every other table and column the removal touches is found by reflecting the live
schema (`app/business_removal/domain/schema.py`), never listed here."""

from __future__ import annotations

# The one place every table name the removal writes by hand is spelled out. Every
# other table it touches is read off the reflected schema, never named here or
# anywhere else in `app/business_removal/`.
BUSINESS_TABLE = "business"
APP_USER_TABLE = "app_user"
INVITATION_TABLE = "invitation"
LOGIN_GUARD_TABLE = "login_guard"
PINNED_CATALOG_TABLE = "pinned_catalog"

# Tables with no `business_id` of their own (docs/adr/0004); the only tables a business
# row delete reaches by a column other than `business_id`.
PLATFORM_TABLES: frozenset[str] = frozenset({BUSINESS_TABLE, INVITATION_TABLE, LOGIN_GUARD_TABLE})

# Alembic's own bookkeeping table: never a business's data, never touched.
SKIPPED_TABLES: frozenset[str] = frozenset({"alembic_version"})

# Deleted along with the business, but never written to the export file.
WITHHELD_TABLES: frozenset[str] = frozenset({INVITATION_TABLE, LOGIN_GUARD_TABLE})

# (table, column) pairs dropped from every exported row, even though their table is
# exported. Each future secret column joins this set in the diff that adds it.
# The pinned catalog's bot token never leaves the server once saved (pinned-catalog.md):
# its ciphertext, the fingerprints derived from it, and the date it was saved on.
EXCLUDED_COLUMNS: frozenset[tuple[str, str]] = frozenset(
    {
        (APP_USER_TABLE, "password_hash"),
        (PINNED_CATALOG_TABLE, "token_ciphertext"),
        (PINNED_CATALOG_TABLE, "token_fingerprint"),
        (PINNED_CATALOG_TABLE, "message_token_fingerprint"),
        (PINNED_CATALOG_TABLE, "token_saved_on"),
    }
)
