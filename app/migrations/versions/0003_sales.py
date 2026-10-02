"""Sales: sale, sale line and payment.

Revision ID: 0003
Revises: 0002
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0003"
down_revision: str | None = "0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "sale",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("business_id", sa.Integer(), nullable=False),
        sa.Column("sale_date", sa.Date(), nullable=False),
        sa.Column("customer_id", sa.Integer(), nullable=True),
        sa.Column("shipping_charged", sa.Integer(), nullable=False),
        sa.Column("note", sa.String(length=200), nullable=True),
        sa.Column("recorded_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(
            ["business_id"], ["business.id"], name=op.f("fk_sale_business_id_business")
        ),
        sa.ForeignKeyConstraint(
            ["customer_id"], ["customer.id"], name=op.f("fk_sale_customer_id_customer")
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_sale")),
    )
    op.create_table(
        "sale_line",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("business_id", sa.Integer(), nullable=False),
        sa.Column("sale_id", sa.Integer(), nullable=False),
        sa.Column("variety_id", sa.Integer(), nullable=False),
        sa.Column("grams_hundredths", sa.Integer(), nullable=False),
        sa.Column("pricing_rule", sa.String(length=10), nullable=False),
        sa.Column("price_per_gram", sa.Integer(), nullable=False),
        sa.Column("line_total", sa.Integer(), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(
            ["business_id"], ["business.id"], name=op.f("fk_sale_line_business_id_business")
        ),
        sa.ForeignKeyConstraint(["sale_id"], ["sale.id"], name=op.f("fk_sale_line_sale_id_sale")),
        sa.ForeignKeyConstraint(
            ["variety_id"], ["variety.id"], name=op.f("fk_sale_line_variety_id_variety")
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_sale_line")),
    )
    op.create_table(
        "payment",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("business_id", sa.Integer(), nullable=False),
        sa.Column("paid_on", sa.Date(), nullable=False),
        sa.Column("amount", sa.Integer(), nullable=False),
        sa.Column("method", sa.String(length=10), nullable=False),
        sa.Column("customer_id", sa.Integer(), nullable=True),
        sa.Column("sale_id", sa.Integer(), nullable=True),
        sa.Column("recorded_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(
            ["business_id"], ["business.id"], name=op.f("fk_payment_business_id_business")
        ),
        sa.ForeignKeyConstraint(
            ["customer_id"], ["customer.id"], name=op.f("fk_payment_customer_id_customer")
        ),
        sa.ForeignKeyConstraint(["sale_id"], ["sale.id"], name=op.f("fk_payment_sale_id_sale")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_payment")),
    )


def downgrade() -> None:
    op.drop_table("payment")
    op.drop_table("sale_line")
    op.drop_table("sale")
