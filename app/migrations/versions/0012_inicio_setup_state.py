"""Inicio's setup state (CONTEXT.md: Inicio's setup state): one results-owned row per
business holding two facts, that its setup checklist is gone and that its bot notice
was dismissed, each the moment it was first stored. No row is written here: a business
that already meets the conditions gets its row the first time Inicio is read, so the
migration pre-writes neither fact.

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
    op.create_table(
        "inicio_setup_state",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("business_id", sa.Integer(), nullable=False),
        sa.Column("checklist_gone_at", sa.DateTime(), nullable=True),
        sa.Column("bot_notice_dismissed_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(
            ["business_id"],
            ["business.id"],
            name=op.f("fk_inicio_setup_state_business_id_business"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_inicio_setup_state")),
        sa.UniqueConstraint("business_id", name=op.f("uq_inicio_setup_state_business_id")),
    )


def downgrade() -> None:
    op.drop_table("inicio_setup_state")
