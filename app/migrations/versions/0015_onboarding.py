"""The Onboarding's state (CONTEXT.md: Onboarding; ADR-0035): one `onboarding` row per
business that is offered it, carrying only the four optional steps' passes and its end.
No backfill: a business that existed before has no row and is never offered one.

Revision ID: 0015
Revises: 0014
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0015"
down_revision: str | None = "0014"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "onboarding",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("business_id", sa.Integer(), nullable=False),
        sa.Column("header_footer_pass", sa.String(length=7), nullable=True),
        sa.Column("bot_pass", sa.String(length=7), nullable=True),
        sa.Column("partner_pass", sa.String(length=7), nullable=True),
        sa.Column("categories_pass", sa.String(length=7), nullable=True),
        sa.Column("ended_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.CheckConstraint(
            "header_footer_pass IN ('done', 'skipped')",
            name=op.f("ck_onboarding_header_footer_pass"),
        ),
        sa.CheckConstraint("bot_pass IN ('done', 'skipped')", name=op.f("ck_onboarding_bot_pass")),
        sa.CheckConstraint(
            "partner_pass IN ('done', 'skipped')", name=op.f("ck_onboarding_partner_pass")
        ),
        sa.CheckConstraint(
            "categories_pass IN ('done', 'skipped')", name=op.f("ck_onboarding_categories_pass")
        ),
        sa.ForeignKeyConstraint(
            ["business_id"], ["business.id"], name=op.f("fk_onboarding_business_id_business")
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_onboarding")),
        sa.UniqueConstraint("business_id", name=op.f("uq_onboarding_business_id")),
    )


def downgrade() -> None:
    op.drop_table("onboarding")
