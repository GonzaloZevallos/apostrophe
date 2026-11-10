"""A payment links to a payment method by id (docs/adr/0055, docs/adr/0082).

In this order: add `payment.payment_method_id` (nullable); give every business, one with
no payment included, its "Cash" and "Transfer"; fill the new column from the frozen
`payment.method` (`cash` -> Cash, `transfer` -> Transfer, of the same business); then one
table rebuild that makes the new column NOT NULL, relaxes `method` to nullable (a new
payment writes NULL there and nothing reads it) and adds the composite foreign key
`(business_id, payment_method_id) -> payment_method(business_id, id)` ON DELETE RESTRICT,
so a payment can never point at another business's method. No value of any pre-existing
column changes (tests/migrations/comparator.py proves it).

The downgrade is one-way once any payment was recorded after this revision: a payment with
a NULL `method` could not be held by the NOT NULL it restores, and that one condition
covers every row the downgrade could not hold, so it refuses while one exists.

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

FOREIGN_KEY = "fk_payment_business_id_payment_method"
INDEX = "ix_payment_business_id_payment_method_id"

# (name, name_key, icon, position) of the two methods every business starts with.
DEFAULTS = (("Cash", "cash", "coins", 1), ("Transfer", "transfer", "bank", 2))


def upgrade() -> None:
    op.add_column("payment", sa.Column("payment_method_id", sa.Integer(), nullable=True))

    connection = op.get_bind()
    for name, name_key, icon, position in DEFAULTS:
        connection.execute(
            sa.text(
                "INSERT INTO payment_method (business_id, name, name_key, icon, position) "
                "SELECT b.id, :name, :name_key, :icon, :position FROM business b "
                "WHERE NOT EXISTS (SELECT 1 FROM payment_method pm "
                "WHERE pm.business_id = b.id AND pm.name_key = :name_key)"
            ),
            {"name": name, "name_key": name_key, "icon": icon, "position": position},
        )
    connection.execute(
        sa.text(
            "UPDATE payment SET payment_method_id = ("
            "SELECT pm.id FROM payment_method pm "
            "WHERE pm.business_id = payment.business_id AND pm.name_key = payment.method)"
        )
    )

    with op.batch_alter_table("payment", recreate="always") as batch_op:
        batch_op.alter_column("payment_method_id", existing_type=sa.Integer(), nullable=False)
        batch_op.alter_column("method", existing_type=sa.String(10), nullable=True)
        batch_op.create_foreign_key(
            op.f(FOREIGN_KEY),
            "payment_method",
            ["business_id", "payment_method_id"],
            ["business_id", "id"],
            ondelete="RESTRICT",
        )
        batch_op.create_index(op.f(INDEX), ["business_id", "payment_method_id"])


def downgrade() -> None:
    connection = op.get_bind()
    unheld = connection.execute(
        sa.text("SELECT COUNT(*) FROM payment WHERE method IS NULL")
    ).scalar_one()
    if unheld:
        raise RuntimeError(
            "cannot downgrade: a payment recorded after this revision has no method value "
            "to restore into the NOT NULL column"
        )
    # Foreign keys off before the first write of the step, as 0023, 0027 and 0028 do: SQLite
    # ignores the pragma inside a write transaction, and a downgrade that walks past this
    # revision down to 0023 rebuilds `sale`, which `payment` points at.
    raw = op.get_bind().connection.dbapi_connection
    assert raw is not None
    was_on = raw.execute("PRAGMA foreign_keys").fetchone()[0]
    raw.execute("PRAGMA foreign_keys=OFF")
    try:
        with op.batch_alter_table("payment", recreate="always") as batch_op:
            batch_op.drop_index(op.f(INDEX))
            batch_op.drop_constraint(op.f(FOREIGN_KEY), type_="foreignkey")
            batch_op.drop_column("payment_method_id")
            batch_op.alter_column("method", existing_type=sa.String(10), nullable=False)
        if raw.execute("PRAGMA foreign_key_check").fetchall():
            raise RuntimeError("the downgrade of 0030 left a broken reference")
    finally:
        raw.execute(f"PRAGMA foreign_keys={'ON' if was_on else 'OFF'}")
