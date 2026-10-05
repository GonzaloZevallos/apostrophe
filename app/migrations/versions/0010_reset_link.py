"""`reset_link` (docs/adr/0019): a row exists only while its link could still work.

Revision ID: 0010
Revises: 0009
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0010"
down_revision: str | None = "0009"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "reset_link",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("business_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("token_digest", sa.String(length=64), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(
            ["business_id"], ["business.id"], name=op.f("fk_reset_link_business_id_business")
        ),
        sa.ForeignKeyConstraint(
            ["user_id"], ["app_user.id"], name=op.f("fk_reset_link_user_id_app_user")
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_reset_link")),
        sa.UniqueConstraint("user_id", name=op.f("uq_reset_link_user_id")),
        sa.UniqueConstraint("token_digest", name=op.f("uq_reset_link_token_digest")),
    )


def downgrade() -> None:
    op.drop_table("reset_link")
