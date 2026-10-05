"""A customer's phone becomes optional (ADR-0021, docs/product/customers.md): a
customer is identified by their own record, never by their phone, so the column is
now nullable. `uq_customer_business_phone` keeps its name; no partial index is added,
since SQLite's own unique-constraint semantics already let any number of customers of
one business share a `NULL` phone.

Revision ID: 0011
Revises: 0010
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0011"
down_revision: str | None = "0010"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("customer", recreate="always") as batch_op:
        batch_op.alter_column("phone", existing_type=sa.String(16), nullable=True)


def downgrade() -> None:
    connection = op.get_bind()
    blank = connection.execute(
        sa.text("SELECT COUNT(*) FROM customer WHERE phone IS NULL")
    ).scalar_one()
    if blank:
        raise RuntimeError(
            "cannot downgrade: a customer with no phone would violate the NOT NULL "
            "this revision is reversing"
        )
    with op.batch_alter_table("customer", recreate="always") as batch_op:
        batch_op.alter_column("phone", existing_type=sa.String(16), nullable=False)
