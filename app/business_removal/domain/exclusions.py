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
RESET_LINK_TABLE = "reset_link"
PINNED_CATALOG_TABLE = "pinned_catalog"

# Tables with no `business_id` of their own (docs/adr/0004); the only tables a business
# row delete reaches by a column other than `business_id`.
PLATFORM_TABLES: frozenset[str] = frozenset({BUSINESS_TABLE, INVITATION_TABLE, LOGIN_GUARD_TABLE})

# Never a business's data, never touched: Alembic's own bookkeeping, and the
# per-address login brake (docs/adr/0017), keyed by an address digest that no
# business owns and shared by every business on the installation.
SKIPPED_TABLES: frozenset[str] = frozenset({"alembic_version", "login_address_guard"})

# Deleted along with the business, but never written to the export file (docs/adr/0019).
# `reset_link` carries its own `business_id` (unlike `invitation` and `login_guard`,
# both platform tables) and is withheld whole rather than exported: a reset link holds
# nothing a business export is for.
WITHHELD_TABLES: frozenset[str] = frozenset(
    {INVITATION_TABLE, LOGIN_GUARD_TABLE, RESET_LINK_TABLE}
)

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
