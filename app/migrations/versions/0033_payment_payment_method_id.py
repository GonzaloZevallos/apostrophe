"""A payment links to its method by id (CONTEXT.md: Payment method;
docs/adr/20261111-payment-methods-by-id).

Revision ID: 0033
Revises: 0032

Adds `payment.payment_method_id` and fills it for every payment from the frozen `method`
value: the business's own method whose `name_key` is that value (0032 seeded "cash" and
"transfer" for every business). Then `payment` is rebuilt once, because SQLite cannot add
a constraint or relax a column in place: `payment_method_id` becomes NOT NULL with the
composite foreign key `(business_id, payment_method_id)` to `payment_method`, ON DELETE
RESTRICT, and `method` becomes nullable. `method` is frozen: no value in it changes, and
a payment written from now on leaves it NULL.

The downgrade refuses while any payment has a NULL `method` (it would lose the only record
of how that payment was made); otherwise it puts back the 0032 table. Foreign keys go off
before its first write, the way 0028 does, and stay as they are.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0033"
down_revision: str | None = "0032"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


class PaymentWithoutMethodColumn(RuntimeError):
    """A payment recorded after 0033 has no `method` value to restore."""


class RebuildLostRows(RuntimeError):
    pass


def _count(table: str) -> int:
    return int(op.get_bind().execute(sa.text(f"SELECT COUNT(*) FROM {table}")).scalar_one())


def _create_payment(name: str, *, linked: bool) -> None:
    columns: list[sa.Column[object] | sa.schema.SchemaItem] = [
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("business_id", sa.Integer(), nullable=False),
        sa.Column("paid_on", sa.Date(), nullable=False),
        sa.Column("amount", sa.Integer(), nullable=False),
        sa.Column("method", sa.String(length=10), nullable=linked),
    ]
    columns += [
        sa.Column("customer_id", sa.Integer(), nullable=True),
        sa.Column("sale_id", sa.Integer(), nullable=True),
        sa.Column("recorded_at", sa.DateTime(), nullable=False),
    ]
    if linked:
        columns.append(sa.Column("payment_method_id", sa.Integer(), nullable=False))
    columns += [
        sa.PrimaryKeyConstraint("id", name=op.f("pk_payment")),
        sa.ForeignKeyConstraint(
            ["business_id"], ["business.id"], name=op.f("fk_payment_business_id_business")
        ),
        sa.ForeignKeyConstraint(
            ["customer_id"], ["customer.id"], name=op.f("fk_payment_customer_id_customer")
        ),
        sa.ForeignKeyConstraint(["sale_id"], ["sale.id"], name=op.f("fk_payment_sale_id_sale")),
    ]
    if linked:
        columns.append(
            sa.ForeignKeyConstraint(
                ["business_id", "payment_method_id"],
                ["payment_method.business_id", "payment_method.id"],
                name=op.f("fk_payment_business_id_payment_method"),
                ondelete="RESTRICT",
            )
        )
    op.create_table(name, *columns)


def _swap(*, linked: bool, copied: str, from_columns: str) -> None:
    scratch = "_new_payment"
    _create_payment(scratch, linked=linked)
    op.execute(f"INSERT INTO {scratch} ({copied}) SELECT {from_columns} FROM payment")
    if _count(scratch) != _count("payment"):
        raise RebuildLostRows("payment")
    op.drop_table("payment")
    op.execute(f"ALTER TABLE {scratch} RENAME TO payment")
    op.create_index(op.f("ix_payment_sale_id"), "payment", ["sale_id"])
    if linked:
        op.create_index(
            op.f("ix_payment_payment_method_id_business_id"),
            "payment",
            ["payment_method_id", "business_id"],
        )


def upgrade() -> None:
    op.add_column("payment", sa.Column("payment_method_id", sa.Integer(), nullable=True))
    op.execute(
        "UPDATE payment SET payment_method_id = (SELECT pm.id FROM payment_method pm "
        "WHERE pm.business_id = payment.business_id AND pm.name_key = payment.method)"
    )
    columns = (
        "id, business_id, paid_on, amount, method, customer_id, sale_id, "
        "recorded_at, payment_method_id"
    )
    raw = op.get_bind().connection.dbapi_connection
    assert raw is not None
    was_on = raw.execute("PRAGMA foreign_keys").fetchone()[0]
    raw.execute("PRAGMA foreign_keys=OFF")
    try:
        _swap(linked=True, copied=columns, from_columns=columns)
    finally:
        raw.execute(f"PRAGMA foreign_keys={'ON' if was_on else 'OFF'}")


def downgrade() -> None:
    raw = op.get_bind().connection.dbapi_connection
    assert raw is not None
    raw.execute("PRAGMA foreign_keys=OFF")
    if (
        op.get_bind()
        .execute(sa.text("SELECT COUNT(*) FROM payment WHERE method IS NULL"))
        .scalar_one()
    ):
        raise PaymentWithoutMethodColumn(
            "a payment recorded with a payment method id has no method value to restore"
        )
    op.drop_index(op.f("ix_payment_payment_method_id_business_id"), table_name="payment")
    columns = "id, business_id, paid_on, amount, method, customer_id, sale_id, recorded_at"
    _swap(linked=False, copied=columns, from_columns=columns)
