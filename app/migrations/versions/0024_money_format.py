"""The business's money format (CONTEXT.md: Money format; docs/adr/0058): one
`money_format` row per business, `symbol`, `decimals` and the `scale` its amount columns
are stored at. Every existing business gets `'$'`, 0, 0: scale 0, the whole-peso storage
it has today, until the part that routes every amount statement through `app/db.py`'s
money helper moves new businesses to scale 2. The upgrade only creates the table and
inserts rows; no column that existed before is touched. The downgrade drops the table.

Revision ID: 0024
Revises: 0023
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0024"
down_revision: str | None = "0023"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "money_format",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("business_id", sa.Integer(), nullable=False),
        sa.Column("symbol", sa.String(), nullable=False),
        sa.Column("decimals", sa.Integer(), nullable=False),
        sa.Column("scale", sa.Integer(), nullable=False),
        sa.CheckConstraint("scale IN (0, 2)", name=op.f("ck_money_format_scale")),
        sa.CheckConstraint("decimals BETWEEN 0 AND 2", name=op.f("ck_money_format_decimals")),
        sa.CheckConstraint("decimals <= scale", name=op.f("ck_money_format_decimals_within_scale")),
        sa.CheckConstraint("trim(symbol) <> ''", name=op.f("ck_money_format_symbol")),
        sa.ForeignKeyConstraint(
            ["business_id"], ["business.id"], name=op.f("fk_money_format_business_id_business")
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_money_format")),
        sa.UniqueConstraint("business_id", name=op.f("uq_money_format_business_id")),
    )
    op.execute(
        "INSERT INTO money_format (business_id, symbol, decimals, scale) "
        "SELECT id, '$', 0, 0 FROM business"
    )


def downgrade() -> None:
    # This is the first write of a chain of downgrades, and SQLite ignores the foreign-key
    # pragma inside a write transaction: 0023's downgrade rebuilds `sale` and needs the keys
    # off from the first write of the transaction, so they go off here, before it, as the
    # runner does, and stay off for the rest of the run. Dropping `money_format` never
    # needed them on.
    raw = op.get_bind().connection.dbapi_connection
    assert raw is not None
    raw.execute("PRAGMA foreign_keys=OFF")
    op.drop_table("money_format")
