"""Record the customer type that priced a sale line (docs/adr/0059). This revision only
adds: two nullable columns on `sale_line`. It changes no value that existed before it.

- `sale_line.customer_type_id`: the type that priced the line. A plain integer with no
  foreign key, so deleting a type never touches a recorded line.
- `sale_line.customer_type_name`: a copy of the type's name when the line was created.

Lines that existed keep both empty; their `vip` rule stays as stored.

Revision ID: 0030
Revises: 0029
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0030"
down_revision: str | None = "0029"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("sale_line", sa.Column("customer_type_id", sa.Integer(), nullable=True))
    op.add_column("sale_line", sa.Column("customer_type_name", sa.String(length=40), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("sale_line") as batch:
        batch.drop_column("customer_type_name")
        batch.drop_column("customer_type_id")
