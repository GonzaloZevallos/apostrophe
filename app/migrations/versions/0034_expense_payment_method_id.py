"""An expense may name the payment method it was paid with (CONTEXT.md: Payment method;
docs/adr/20261111-payment-methods-by-id).

Revision ID: 0034
Revises: 0033

Adds `expense.payment_method_id`, nullable, with the composite foreign key
`(business_id, payment_method_id)` to `payment_method`, ON DELETE RESTRICT, so an expense
can only name a method of its own business, and the index over the same two columns.
Nothing reads or writes the column yet and no existing expense is given a value: it stays
NULL. SQLite cannot add a constraint in place, so `expense` is rebuilt once, the way 0028
and 0033 do: `_new_expense` is created with every column and every name spelled with
`op.f`, every row is copied with its id, the counts are compared (a difference refuses
with the table name only), `expense` is dropped, `_new_expense` is renamed, and only then
are the indexes created. No table points at `expense`. No value or name that existed
changes.

The upgrade runs with foreign keys off and puts the previous state back, and refuses if
`PRAGMA foreign_key_check` finds a broken reference afterwards.

The downgrade refuses, before any pragma or DDL, while any expense has a payment method
(dropping the column would lose the only record of how it was paid); otherwise it puts
back the 0033 table. Foreign keys go off before its first write, the way 0028 does, and
stay as they are: it is a step of a walk down from head, and SQLite ignores
`PRAGMA foreign_keys` once a write transaction is open.
"""

from collections.abc import Iterator, Sequence
from contextlib import contextmanager

import sqlalchemy as sa
from alembic import op

revision: str = "0034"
down_revision: str | None = "0033"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_COLUMNS = "id, business_id, expense_category_id, spent_on, amount, detail, recorded_at"


class RebuildLostRows(RuntimeError):
    pass


class RebuildLeftBrokenReferences(RuntimeError):
    pass


class ExpenseWithPaymentMethod(RuntimeError):
    """An expense recorded with a payment method has nowhere to keep it in 0033."""


@contextmanager
def _foreign_keys_off() -> Iterator[None]:
    """The rebuild drops a table; the runner has foreign keys off already, a caller that
    does not gets them off here, before the first write of the step, and the check below
    stands in for the enforcement it lost."""
    raw = op.get_bind().connection.dbapi_connection
    assert raw is not None
    was_on = raw.execute("PRAGMA foreign_keys").fetchone()[0]
    raw.execute("PRAGMA foreign_keys=OFF")
    try:
        yield
        if raw.execute("PRAGMA foreign_key_check").fetchall():
            raise RebuildLeftBrokenReferences(revision)
    finally:
        raw.execute(f"PRAGMA foreign_keys={'ON' if was_on else 'OFF'}")


def _count(table: str) -> int:
    return int(op.get_bind().execute(sa.text(f"SELECT COUNT(*) FROM {table}")).scalar_one())


def _create_expense(name: str, *, linked: bool) -> None:
    columns: list[sa.Column[object] | sa.schema.SchemaItem] = [
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("business_id", sa.Integer(), nullable=False),
        sa.Column("expense_category_id", sa.Integer(), nullable=False),
        sa.Column("spent_on", sa.Date(), nullable=False),
        sa.Column("amount", sa.Integer(), nullable=False),
        sa.Column("detail", sa.String(length=200), nullable=False),
        sa.Column("recorded_at", sa.DateTime(), nullable=False),
    ]
    if linked:
        columns.append(sa.Column("payment_method_id", sa.Integer(), nullable=True))
    columns += [
        sa.ForeignKeyConstraint(
            ["business_id"], ["business.id"], name=op.f("fk_expense_business_id_business")
        ),
        sa.ForeignKeyConstraint(
            ["business_id", "expense_category_id"],
            ["expense_category.business_id", "expense_category.id"],
            name=op.f("fk_expense_business_id_expense_category"),
            ondelete="RESTRICT",
        ),
    ]
    if linked:
        columns.append(
            sa.ForeignKeyConstraint(
                ["business_id", "payment_method_id"],
                ["payment_method.business_id", "payment_method.id"],
                name=op.f("fk_expense_business_id_payment_method"),
                ondelete="RESTRICT",
            )
        )
    columns.append(sa.PrimaryKeyConstraint("id", name=op.f("pk_expense")))
    op.create_table(name, *columns)


def _swap(*, linked: bool, copied: str) -> None:
    scratch = "_new_expense"
    _create_expense(scratch, linked=linked)
    op.execute(f"INSERT INTO {scratch} ({copied}) SELECT {copied} FROM expense")
    if _count(scratch) != _count("expense"):
        raise RebuildLostRows("expense")
    op.drop_table("expense")
    op.execute(f"ALTER TABLE {scratch} RENAME TO expense")
    op.create_index(
        op.f("ix_expense_business_id_expense_category_id"),
        "expense",
        ["business_id", "expense_category_id"],
    )
    op.create_index(op.f("ix_expense_business_id_spent_on"), "expense", ["business_id", "spent_on"])
    if linked:
        op.create_index(
            op.f("ix_expense_business_id_payment_method_id"),
            "expense",
            ["business_id", "payment_method_id"],
        )


def upgrade() -> None:
    with _foreign_keys_off():
        _swap(linked=True, copied=_COLUMNS)


def downgrade() -> None:
    if (
        op.get_bind()
        .execute(sa.text("SELECT COUNT(*) FROM expense WHERE payment_method_id IS NOT NULL"))
        .scalar_one()
    ):
        raise ExpenseWithPaymentMethod(
            "an expense recorded with a payment method has no place to keep it before 0034"
        )
    raw = op.get_bind().connection.dbapi_connection
    assert raw is not None
    raw.execute("PRAGMA foreign_keys=OFF")
    _swap(linked=False, copied=_COLUMNS)
