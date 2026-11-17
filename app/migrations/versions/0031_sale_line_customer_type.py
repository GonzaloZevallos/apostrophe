"""Record the customer type that priced a sale line (docs/adr/0059). This revision only
adds: two nullable columns on `sale_line`. It changes no value that existed before it.

- `sale_line.customer_type_id`: the type that priced the line. A plain integer with no
  foreign key, so deleting a type never touches a recorded line.
- `sale_line.customer_type_name`: a copy of the type's name when the line was created.

Lines that existed keep both empty; their `vip` rule stays as stored.

Revision ID: 0031
Revises: 0030
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0031"
down_revision: str | None = "0030"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("sale_line", sa.Column("customer_type_id", sa.Integer(), nullable=True))
    op.add_column("sale_line", sa.Column("customer_type_name", sa.String(length=40), nullable=True))


def downgrade() -> None:
    # The first step of a walk down from head: SQLite ignores `PRAGMA foreign_keys` once a
    # write transaction is open, so foreign keys go off before this step's first write, as
    # 0030 and 0028 do, for the rebuilds of `sale` and `customer` further down. They are not
    # put back: every new connection sets the pragma on again in `app/db.py`.
    raw = op.get_bind().connection.dbapi_connection
    assert raw is not None
    raw.execute("PRAGMA foreign_keys=OFF")
    op.drop_column("sale_line", "customer_type_name")
    op.drop_column("sale_line", "customer_type_id")
