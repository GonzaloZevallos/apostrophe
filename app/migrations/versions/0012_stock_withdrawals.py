"""Stock withdrawals (CONTEXT.md: Stock withdrawal, Promotion, Own use; ADR-0030): a
header with its reason, date and note, and its lines of variety and grams.

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
        "stock_withdrawal",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("business_id", sa.Integer(), nullable=False),
        sa.Column("reason", sa.String(length=9), nullable=False),
        sa.Column("withdrawn_on", sa.Date(), nullable=False),
        sa.Column("note", sa.String(length=200), nullable=True),
        sa.Column("recorded_at", sa.DateTime(), nullable=False),
        sa.CheckConstraint(
            "reason IN ('promotion', 'own_use')", name=op.f("ck_stock_withdrawal_reason")
        ),
        sa.ForeignKeyConstraint(
            ["business_id"],
            ["business.id"],
            name=op.f("fk_stock_withdrawal_business_id_business"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_stock_withdrawal")),
    )
    op.create_table(
        "stock_withdrawal_line",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("business_id", sa.Integer(), nullable=False),
        sa.Column("stock_withdrawal_id", sa.Integer(), nullable=False),
        sa.Column("variety_id", sa.Integer(), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("grams_hundredths", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(
            ["business_id"],
            ["business.id"],
            name=op.f("fk_stock_withdrawal_line_business_id_business"),
        ),
        sa.ForeignKeyConstraint(
            ["stock_withdrawal_id"],
            ["stock_withdrawal.id"],
            name=op.f("fk_stock_withdrawal_line_stock_withdrawal_id_stock_withdrawal"),
        ),
        sa.ForeignKeyConstraint(
            ["variety_id"],
            ["variety.id"],
            name=op.f("fk_stock_withdrawal_line_variety_id_variety"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_stock_withdrawal_line")),
        sa.UniqueConstraint(
            "stock_withdrawal_id",
            "position",
            name=op.f("uq_stock_withdrawal_line_stock_withdrawal_id_position"),
        ),
    )
    op.create_index(
        op.f("ix_stock_withdrawal_line_business_id_variety_id"),
        "stock_withdrawal_line",
        ["business_id", "variety_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_stock_withdrawal_line_business_id_variety_id"),
        table_name="stock_withdrawal_line",
    )
    op.drop_table("stock_withdrawal_line")
    op.drop_table("stock_withdrawal")
