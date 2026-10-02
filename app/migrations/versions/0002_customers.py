"""Customers.

Revision ID: 0002
Revises: 0001
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0002"
down_revision: str | None = "0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "customer",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("business_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=60), nullable=False),
        sa.Column("phone", sa.String(length=16), nullable=False),
        sa.Column("channel", sa.String(length=16), nullable=True),
        sa.Column("vip", sa.Boolean(), nullable=False),
        sa.ForeignKeyConstraint(
            ["business_id"], ["business.id"], name=op.f("fk_customer_business_id_business")
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_customer")),
        sa.UniqueConstraint("business_id", "phone", name=op.f("uq_customer_business_phone")),
    )


def downgrade() -> None:
    op.drop_table("customer")
