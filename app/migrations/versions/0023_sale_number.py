"""Give every sale its per-business number (CONTEXT.md: Sale number, docs/adr/0073).

Revision ID: 0023
Revises: 0022

`business.last_sale_number` is the highest number the business ever gave, added with a
server default of 0. `sale.number` is added nullable and filled for the existing sales per
business by `(sale_date, recorded_at, id)`; each counter is then set to that business's
highest number (0 with no sale). The table is rebuilt once after, to make `number` not
null and to add `uq_sale_business_id_number`, because a batch rebuild copies rows and
cannot compute a fill. The new column has no default of any kind. The downgrade drops the
constraint and both columns.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0023"
down_revision: str | None = "0022"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("business") as batch:
        batch.add_column(
            sa.Column("last_sale_number", sa.Integer(), nullable=False, server_default="0")
        )
    with op.batch_alter_table("sale") as batch:
        batch.add_column(sa.Column("number", sa.Integer(), nullable=True))

    connection = op.get_bind()
    connection.execute(
        sa.text(
            "UPDATE sale SET number = ("
            "SELECT rn FROM ("
            "SELECT id, ROW_NUMBER() OVER ("
            "PARTITION BY business_id ORDER BY sale_date, recorded_at, id) AS rn FROM sale"
            ") r WHERE r.id = sale.id)"
        )
    )
    connection.execute(
        sa.text(
            "UPDATE business SET last_sale_number = COALESCE("
            "(SELECT MAX(number) FROM sale WHERE sale.business_id = business.id), 0)"
        )
    )

    with op.batch_alter_table("sale", recreate="always") as batch:
        batch.alter_column("number", existing_type=sa.Integer(), nullable=False)
        batch.create_unique_constraint(
            op.f("uq_sale_business_id_number"), ["business_id", "number"]
        )


def downgrade() -> None:
    # Rebuilding `sale` drops a table `sale_line` and `payment` point at. The runner has
    # foreign keys off already; a caller that does not gets them off here, before the first
    # write of the step (SQLite ignores the pragma inside a write transaction), and the
    # check below stands in for the enforcement it lost.
    raw = op.get_bind().connection.dbapi_connection
    assert raw is not None
    was_on = raw.execute("PRAGMA foreign_keys").fetchone()[0]
    raw.execute("PRAGMA foreign_keys=OFF")
    try:
        with op.batch_alter_table("sale", recreate="always") as batch:
            batch.drop_constraint(op.f("uq_sale_business_id_number"), type_="unique")
            batch.drop_column("number")
        # A native `DROP COLUMN`, as in 0018: no table rebuild for `business`.
        op.drop_column("business", "last_sale_number")
        if raw.execute("PRAGMA foreign_key_check").fetchall():
            raise RuntimeError("the downgrade of 0023 left a broken reference")
    finally:
        raw.execute(f"PRAGMA foreign_keys={'ON' if was_on else 'OFF'}")
