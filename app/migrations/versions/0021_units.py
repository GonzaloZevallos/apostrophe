"""A business's own units (docs/adr/0055, docs/adr/0056, docs/product/units.md).

Creates `unit`, adds `variety.unit_id`, gives every existing business one unit,
"grams" / "g" with 2 decimals, and points every one of its varieties at it. Nothing that
existed before changes value: the migration only adds a table, a column and rows, and
fills the new column. The column is then made NOT NULL with its foreign key and index in
one batch (SQLite alters a table by copying it; the runner switches foreign keys off).

Revision ID: 0021
Revises: 0019
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0021"
# 0020 is reserved by another part of the same epic and is not in this tree yet; this
# revision sits on the head the chain has here.
down_revision: str | None = "0019"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "unit",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("business_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=60), nullable=False),
        sa.Column("name_key", sa.String(length=60), nullable=False),
        sa.Column("label", sa.String(length=20), nullable=False),
        sa.Column("decimals", sa.Integer(), nullable=False),
        sa.CheckConstraint("decimals BETWEEN 0 AND 2", name=op.f("ck_unit_decimals_range")),
        sa.ForeignKeyConstraint(
            ["business_id"], ["business.id"], name=op.f("fk_unit_business_id_business")
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_unit")),
        sa.UniqueConstraint("business_id", "name_key", name=op.f("uq_unit_business_id_name_key")),
    )
    op.add_column("variety", sa.Column("unit_id", sa.Integer(), nullable=True))
    op.execute(
        "INSERT INTO unit (business_id, name, name_key, label, decimals) "
        "SELECT id, 'grams', 'grams', 'g', 2 FROM business"
    )
    op.execute(
        "UPDATE variety SET unit_id = "
        "(SELECT unit.id FROM unit WHERE unit.business_id = variety.business_id)"
    )
    with op.batch_alter_table("variety") as batch:
        batch.alter_column("unit_id", existing_type=sa.Integer(), nullable=False)
        batch.create_foreign_key(op.f("fk_variety_unit_id_unit"), "unit", ["unit_id"], ["id"])
        batch.create_index(op.f("ix_variety_unit_id"), ["unit_id"])


def downgrade() -> None:
    # SQLite drops a column that carries a foreign key by copying the table, and five
    # tables reference `variety`: the copy must not trip them, as in the runner's upgrade.
    # The pragma only takes effect outside a transaction, which is where a downgrade's
    # first statement runs; the references are checked again once the copy is back.
    op.execute("PRAGMA foreign_keys = OFF")
    with op.batch_alter_table("variety") as batch:
        batch.drop_index(op.f("ix_variety_unit_id"))
        batch.drop_constraint(op.f("fk_variety_unit_id_unit"), type_="foreignkey")
        batch.drop_column("unit_id")
    op.drop_table("unit")
    op.execute("PRAGMA foreign_keys = ON")
