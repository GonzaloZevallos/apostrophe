"""A variety can be archived (ADR-0032, docs/product/varieties.md): `variety.archived_at`
is the instant it left the lists, null while it is live. A native ADD COLUMN, with no
default and no backfill, and a native DROP COLUMN: no table rebuild, so no row of the
five tables that reference `variety` is copied.

Revision ID: 0013
Revises: 0012
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

from app.db import UtcDateTime

revision: str = "0013"
down_revision: str | None = "0012"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("variety", sa.Column("archived_at", UtcDateTime(), nullable=True))


def downgrade() -> None:
    connection = op.get_bind()
    archived = connection.execute(
        sa.text("SELECT 1 FROM variety WHERE archived_at IS NOT NULL LIMIT 1")
    ).first()
    if archived is not None:
        raise RuntimeError(
            "cannot downgrade: an archived variety would come back to the lists, "
            "restore every archived variety first"
        )
    op.execute("ALTER TABLE variety DROP COLUMN archived_at")
