"""The one `pinned_catalog` table (CONTEXT.md: Bot settings, Pinned catalog, Out of
date), one row per business, added lazily on the first settings save or the first
recorded attempt — no row is seeded here, unlike `catalog_header_footer`.

Revision ID: 0007
Revises: 0006
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0007"
down_revision: str | None = "0006"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "pinned_catalog",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("business_id", sa.Integer(), nullable=False),
        sa.Column("token_ciphertext", sa.LargeBinary(), nullable=True),
        sa.Column("token_fingerprint", sa.String(length=64), nullable=True),
        sa.Column("token_saved_on", sa.Date(), nullable=True),
        sa.Column("own_chat", sa.String(length=200), nullable=True),
        sa.Column("channel_chat", sa.String(length=200), nullable=True),
        sa.Column("message_id", sa.Integer(), nullable=True),
        sa.Column("message_chat", sa.String(length=200), nullable=True),
        sa.Column("message_token_fingerprint", sa.String(length=64), nullable=True),
        sa.Column("last_published_text", sa.Text(), nullable=True),
        sa.Column("last_published_at", sa.DateTime(), nullable=True),
        sa.Column("last_failure", sa.String(length=32), nullable=True),
        sa.Column("last_checked_on", sa.Date(), nullable=True),
        sa.ForeignKeyConstraint(
            ["business_id"],
            ["business.id"],
            name=op.f("fk_pinned_catalog_business_id_business"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_pinned_catalog")),
        sa.UniqueConstraint("business_id", name=op.f("uq_pinned_catalog_business_id")),
    )


def downgrade() -> None:
    op.drop_table("pinned_catalog")
