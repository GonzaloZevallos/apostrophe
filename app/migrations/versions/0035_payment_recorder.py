"""A payment can keep who recorded it (docs/product/payments.md; GH-1057).

Revision ID: 0035
Revises: 0034

Adds two nullable columns to `payment`: `recorded_by_initials` (up to 32 characters, kept
as saved) and `recorded_by_app_user_id`, a plain foreign key to `app_user.id`, ON DELETE
SET NULL, with an index. Nothing writes them yet and no existing payment is given a value.
The recording instant stays the existing `payment.recorded_at`. SQLite cannot add a
constraint in place, so `payment` is rebuilt once, the way 0033 does: `_new_payment` is
created with every column and every name spelled with `op.f`, every row is copied with its
id, the counts are compared (a difference refuses with the table name only), `payment` is
dropped, `_new_payment` is renamed, and only then are the indexes created.

What protects the swap: (1) `app/migrations/runner.py` turns foreign keys off before the
transaction opens and checks them once after it; (2) no table points at `payment` at 0034,
so the drop and the rename cannot orphan a row of another table; (3) the pragma check and
the restore in `finally` below only guard a caller that bypasses the runner. The pragma
check is no guarantee inside an open transaction, which is why (1) matters.

The downgrade refuses, before any write, while any payment holds either new column
(dropping them would lose a recorded fact); otherwise it puts back the 0034 table.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0035"
down_revision: str | None = "0034"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_COLUMNS = (
    "id, business_id, paid_on, amount, method, customer_id, sale_id, recorded_at, payment_method_id"
)


class RebuildLostRows(RuntimeError):
    pass


class RebuildLeftBrokenReferences(RuntimeError):
    pass


class PaymentRecorderSet(RuntimeError):
    """A payment that keeps its recorder has nowhere to keep it in 0034."""


def _count(table: str) -> int:
    return int(op.get_bind().execute(sa.text(f"SELECT COUNT(*) FROM {table}")).scalar_one())


def _create_payment(name: str, *, recorder: bool) -> None:
    columns: list[sa.Column[object] | sa.schema.SchemaItem] = [
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("business_id", sa.Integer(), nullable=False),
        sa.Column("paid_on", sa.Date(), nullable=False),
        sa.Column("amount", sa.Integer(), nullable=False),
        sa.Column("method", sa.String(length=10), nullable=True),
        sa.Column("customer_id", sa.Integer(), nullable=True),
        sa.Column("sale_id", sa.Integer(), nullable=True),
        sa.Column("recorded_at", sa.DateTime(), nullable=False),
        sa.Column("payment_method_id", sa.Integer(), nullable=False),
    ]
    if recorder:
        columns += [
            sa.Column("recorded_by_initials", sa.String(length=32), nullable=True),
            sa.Column("recorded_by_app_user_id", sa.Integer(), nullable=True),
        ]
    columns += [
        sa.PrimaryKeyConstraint("id", name=op.f("pk_payment")),
        sa.ForeignKeyConstraint(
            ["business_id"], ["business.id"], name=op.f("fk_payment_business_id_business")
        ),
        sa.ForeignKeyConstraint(
            ["customer_id"], ["customer.id"], name=op.f("fk_payment_customer_id_customer")
        ),
        sa.ForeignKeyConstraint(["sale_id"], ["sale.id"], name=op.f("fk_payment_sale_id_sale")),
        sa.ForeignKeyConstraint(
            ["business_id", "payment_method_id"],
            ["payment_method.business_id", "payment_method.id"],
            name=op.f("fk_payment_business_id_payment_method"),
            ondelete="RESTRICT",
        ),
    ]
    if recorder:
        columns.append(
            sa.ForeignKeyConstraint(
                ["recorded_by_app_user_id"],
                ["app_user.id"],
                name=op.f("fk_payment_recorded_by_app_user_id_app_user"),
                ondelete="SET NULL",
            )
        )
    op.create_table(name, *columns)


def _swap(*, recorder: bool) -> None:
    scratch = "_new_payment"
    _create_payment(scratch, recorder=recorder)
    op.execute(f"INSERT INTO {scratch} ({_COLUMNS}) SELECT {_COLUMNS} FROM payment")
    if _count(scratch) != _count("payment"):
        raise RebuildLostRows("payment")
    op.drop_table("payment")
    op.execute(f"ALTER TABLE {scratch} RENAME TO payment")
    op.create_index(op.f("ix_payment_sale_id"), "payment", ["sale_id"])
    op.create_index(
        op.f("ix_payment_payment_method_id_business_id"),
        "payment",
        ["payment_method_id", "business_id"],
    )
    if recorder:
        op.create_index(
            op.f("ix_payment_recorded_by_app_user_id"), "payment", ["recorded_by_app_user_id"]
        )


def upgrade() -> None:
    raw = op.get_bind().connection.dbapi_connection
    assert raw is not None
    was_on = raw.execute("PRAGMA foreign_keys").fetchone()[0]
    raw.execute("PRAGMA foreign_keys=OFF")
    try:
        _swap(recorder=True)
        if raw.execute("PRAGMA foreign_key_check").fetchall():
            raise RebuildLeftBrokenReferences(revision)
    finally:
        raw.execute(f"PRAGMA foreign_keys={'ON' if was_on else 'OFF'}")


def downgrade() -> None:
    if (
        op.get_bind()
        .execute(
            sa.text(
                "SELECT COUNT(*) FROM payment "
                "WHERE recorded_by_initials IS NOT NULL OR recorded_by_app_user_id IS NOT NULL"
            )
        )
        .scalar_one()
    ):
        raise PaymentRecorderSet(
            "a payment that keeps its recorder has no place to keep it before 0035"
        )
    raw = op.get_bind().connection.dbapi_connection
    assert raw is not None
    raw.execute("PRAGMA foreign_keys=OFF")
    op.drop_index(op.f("ix_payment_recorded_by_app_user_id"), table_name="payment")
    op.drop_index(op.f("ix_payment_payment_method_id_business_id"), table_name="payment")
    op.drop_index(op.f("ix_payment_sale_id"), table_name="payment")
    _swap(recorder=False)
