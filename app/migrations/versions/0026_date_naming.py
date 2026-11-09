"""Database naming (CODING_STANDARDS §11, docs/adr/0077): `sale.sale_date` becomes
`sold_on` and `stock_entry.entry_date` becomes `entered_on`.

Revision ID: 0026
Revises: 0025

SQLite renames a column in place (`RENAME COLUMN` rewrites only the schema text), so no
table is rebuilt and no row is copied. Only one index covers a renamed column, 0016's
`ix_sale_business_id_sale_date`; it is dropped before the rename and created again under
the convention name after it (`op.f` spells the final name). `stock_entry` has no index on
its date. The downgrade is the exact mirror and restores the 0025 schema, names included.
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0026"
down_revision: str | None = "0025"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.drop_index(op.f("ix_sale_business_id_sale_date"), table_name="sale")
    op.execute("ALTER TABLE sale RENAME COLUMN sale_date TO sold_on")
    op.create_index(
        op.f("ix_sale_business_id_sold_on"), "sale", ["business_id", "sold_on"], unique=False
    )
    op.execute("ALTER TABLE stock_entry RENAME COLUMN entry_date TO entered_on")


def downgrade() -> None:
    op.execute("ALTER TABLE stock_entry RENAME COLUMN entered_on TO entry_date")
    op.drop_index(op.f("ix_sale_business_id_sold_on"), table_name="sale")
    op.execute("ALTER TABLE sale RENAME COLUMN sold_on TO sale_date")
    op.create_index(
        op.f("ix_sale_business_id_sale_date"), "sale", ["business_id", "sale_date"], unique=False
    )
