"""`variety.archived_at` (docs/product/varieties.md): a nullable instant, `NULL` for a live
variety. A native ADD and DROP COLUMN, with no table rebuild, so the five tables that
reference `variety` keep every row.

Revision ID: 0012
Revises: 0011
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0012"
down_revision: str | None = "0011"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("variety", sa.Column("archived_at", sa.DateTime(), nullable=True))


def downgrade() -> None:
    op.drop_column("variety", "archived_at")
