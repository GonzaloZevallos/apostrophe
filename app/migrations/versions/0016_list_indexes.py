"""The three indexes the Ventas list needs (ADR-0038): `sale` by business and date,
`sale_line` and `payment` by sale. An index changes what a read costs, never what it
returns; no row is touched.

Revision ID: 0016
Revises: 0015
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0016"
down_revision: str | None = "0015"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_index(
        op.f("ix_sale_business_id_sale_date"), "sale", ["business_id", "sale_date"], unique=False
    )
    op.create_index(op.f("ix_sale_line_sale_id"), "sale_line", ["sale_id"], unique=False)
    op.create_index(op.f("ix_payment_sale_id"), "payment", ["sale_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_payment_sale_id"), table_name="payment")
    op.drop_index(op.f("ix_sale_line_sale_id"), table_name="sale_line")
    op.drop_index(op.f("ix_sale_business_id_sale_date"), table_name="sale")
