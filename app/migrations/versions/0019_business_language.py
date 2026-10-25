"""Store a language on every business (docs/adr/0050). The column is added with a server
default of `'en'`, so every existing row gets an explicit English, and the default is
dropped in a second step: from then on a row without a language is refused, and the code
always says which. No check constraint: the selectable list is a domain rule, not a
schema one. The downgrade drops the column natively.

Revision ID: 0019
Revises: 0018
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0019"
down_revision: str | None = "0018"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("business") as batch:
        batch.add_column(
            sa.Column("language", sa.String(length=35), nullable=False, server_default="en")
        )
    with op.batch_alter_table("business") as batch:
        batch.alter_column(
            "language",
            existing_type=sa.String(length=35),
            existing_nullable=False,
            server_default=None,
        )


def downgrade() -> None:
    # A native `DROP COLUMN`, as in 0018: no table rebuild, so no foreign key is touched.
    op.drop_column("business", "language")
