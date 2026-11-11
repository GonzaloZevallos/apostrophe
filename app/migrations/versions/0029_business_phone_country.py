"""Store a Phone country on every business (CONTEXT.md: Phone country, docs/adr/0082).

Revision ID: 0029
Revises: 0028

The column is added nullable, with no default, index or check constraint (the list of
countries is a domain rule, not a schema one), and then every business that exists is set
to Argentina, so its numbers keep reading as an Argentine mobile. A business opened after
this starts with none. Nothing that existed is rewritten but the new column. The
downgrade drops the column natively.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0029"
down_revision: str | None = "0028"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("business", sa.Column("default_phone_country", sa.String(length=2)))
    op.execute("UPDATE business SET default_phone_country = 'AR'")


def downgrade() -> None:
    # A native `DROP COLUMN`, as in 0019: no table rebuild, so no foreign key is touched.
    # It is the first step of a walk down from head, and SQLite ignores `PRAGMA foreign_keys`
    # once a write transaction is open, so foreign keys go off before this first write and
    # are not put back (as 0028 does): else 0023's rebuild of `sale` would run with them on.
    # Every new connection sets the pragma on again in `app/db.py`.
    raw = op.get_bind().connection.dbapi_connection
    assert raw is not None
    raw.execute("PRAGMA foreign_keys=OFF")
    op.drop_column("business", "default_phone_country")
