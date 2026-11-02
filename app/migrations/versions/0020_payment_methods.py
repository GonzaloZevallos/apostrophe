"""A business's own list of payment methods (docs/adr/0055). This revision creates the
table only and writes no row: the rows for existing businesses, and the column a payment
links to a method with, arrive in 0021. The downgrade drops the table.

Revision ID: 0020
Revises: 0019
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0020"
down_revision: str | None = "0019"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "payment_method",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("business_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=40), nullable=False),
        sa.Column("name_key", sa.String(length=40), nullable=False),
        sa.Column("icon", sa.String(length=10), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("archived_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(
            ["business_id"], ["business.id"], name=op.f("fk_payment_method_business_id_business")
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_payment_method")),
        sa.UniqueConstraint(
            "business_id", "name_key", name=op.f("uq_payment_method_business_id_name_key")
        ),
        sa.UniqueConstraint("business_id", "id", name=op.f("uq_payment_method_business_id_id")),
    )


def downgrade() -> None:
    op.drop_table("payment_method")
