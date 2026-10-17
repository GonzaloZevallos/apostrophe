"""Drop `customer.channel` for good (ADR-0047): nothing reads or writes it any more, and no
copy of its values is kept anywhere. The upgrade is a native `DROP COLUMN` with no table
recreate, so no other column, row or foreign key is touched. The downgrade gives back an
empty, nullable column and restores no data.

Revision ID: 0018
Revises: 0017
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0018"
down_revision: str | None = "0017"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.drop_column("customer", "channel")


def downgrade() -> None:
    op.add_column("customer", sa.Column("channel", sa.String(length=16), nullable=True))
