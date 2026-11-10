"""Store a Phone country on every business (CONTEXT.md: Phone country, docs/adr/0082).

Revision ID: 0023
Revises: 0022

The column is added nullable, with no default, index or check constraint (the list of
countries is a domain rule, not a schema one), and then every business that exists is set
to Argentina, so its numbers keep reading as an Argentine mobile. A business opened after
this starts with none. Nothing that existed is rewritten but the new column. The
downgrade drops the column natively.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0023"
down_revision: str | None = "0022"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("business", sa.Column("default_phone_country", sa.String(length=2)))
    op.execute("UPDATE business SET default_phone_country = 'AR'")


def downgrade() -> None:
    # A native `DROP COLUMN`, as in 0019: no table rebuild, so no foreign key is touched.
    op.drop_column("business", "default_phone_country")
