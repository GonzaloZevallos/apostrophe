"""Stock entries and thresholds (CONTEXT.md: Stock entry, Low-stock threshold).

Revision ID: 0005
Revises: 0004
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0005"
down_revision: str | None = "0004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "stock_entry",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("business_id", sa.Integer(), nullable=False),
        sa.Column("entry_date", sa.Date(), nullable=False),
        sa.Column("variety_id", sa.Integer(), nullable=False),
        sa.Column("origin", sa.String(length=20), nullable=False),
        sa.Column("grams_hundredths", sa.Integer(), nullable=False),
        sa.Column("total_cost", sa.Integer(), nullable=True),
        sa.Column("note", sa.String(length=200), nullable=True),
        sa.Column("recorded_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(
            ["business_id"], ["business.id"], name=op.f("fk_stock_entry_business_id_business")
        ),
        sa.ForeignKeyConstraint(
            ["variety_id"], ["variety.id"], name=op.f("fk_stock_entry_variety_id_variety")
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_stock_entry")),
    )
    op.create_table(
        "stock_threshold",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("business_id", sa.Integer(), nullable=False),
        sa.Column("variety_id", sa.Integer(), nullable=False),
        sa.Column("threshold_hundredths", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(
            ["business_id"],
            ["business.id"],
            name=op.f("fk_stock_threshold_business_id_business"),
        ),
        sa.ForeignKeyConstraint(
            ["variety_id"], ["variety.id"], name=op.f("fk_stock_threshold_variety_id_variety")
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_stock_threshold")),
        sa.UniqueConstraint(
            "business_id", "variety_id", name=op.f("uq_stock_threshold_business_id_variety_id")
        ),
    )


def downgrade() -> None:
    op.drop_table("stock_threshold")
    op.drop_table("stock_entry")
