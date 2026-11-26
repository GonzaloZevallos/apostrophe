"""Stock movements are read by business and date: one index on each movement table.

Revision ID: 0035
Revises: 0034

Adds `ix_stock_entry_business_id_entered_on` on `stock_entry (business_id, entered_on)`
and `ix_stock_withdrawal_business_id_withdrawn_on` on
`stock_withdrawal (business_id, withdrawn_on)`. No row or column changes. The downgrade
drops both. It is the first step of a walk down from head, and the table rebuilds below it
(0034 and earlier) need foreign keys off, which SQLite ignores once a write transaction is
open: so foreign keys go off before its first DDL, the way 0034 does, and stay as they are.
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0035"
down_revision: str | None = "0034"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_index(
        op.f("ix_stock_entry_business_id_entered_on"),
        "stock_entry",
        ["business_id", "entered_on"],
    )
    op.create_index(
        op.f("ix_stock_withdrawal_business_id_withdrawn_on"),
        "stock_withdrawal",
        ["business_id", "withdrawn_on"],
    )


def downgrade() -> None:
    raw = op.get_bind().connection.dbapi_connection
    assert raw is not None
    raw.execute("PRAGMA foreign_keys=OFF")
    op.drop_index(op.f("ix_stock_withdrawal_business_id_withdrawn_on"), "stock_withdrawal")
    op.drop_index(op.f("ix_stock_entry_business_id_entered_on"), "stock_entry")
