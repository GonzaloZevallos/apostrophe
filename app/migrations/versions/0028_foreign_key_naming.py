"""Database naming (CODING_STANDARDS §11): `expense.category_id` becomes
`expense_category_id` and `reset_link.user_id` becomes `app_user_id`, with the constraints
and the index that cover them renamed to match.

Revision ID: 0028
Revises: 0027

This is the last part of #75, planned as revision 0027. Part 3 took 0027 first, so this
one is 0028: the content is the same, only the number moved.

`RENAME COLUMN` would leave the names of the constraints and the index as they were, and
SQLite cannot rename a constraint, so both tables are rebuilt. For each one the new table
`_new_<t>` is created with its columns, primary key, unique constraints and foreign keys
(`op.f` spells each final name) and no index; every row is copied with the renamed column
going into its new name; the counts are compared; the old table is dropped; `_new_<t>` is
renamed to `<t>`; and only then are the indexes created, so a name is never held by two
tables at once. No table points at `expense` or `reset_link`. A count that differs refuses
with the table name only: never row data.

What is renamed:
- `expense.category_id` -> `expense_category_id`, its index
  `ix_expense_business_id_category_id` -> `ix_expense_business_id_expense_category_id`;
  the composite foreign key to `expense_category` keeps its name and its ON DELETE
  RESTRICT. `ix_expense_business_id_spent_on` keeps its name.
- `reset_link.user_id` -> `app_user_id`, `uq_reset_link_user_id` ->
  `uq_reset_link_app_user_id`, `fk_reset_link_user_id_app_user` ->
  `fk_reset_link_app_user_id_app_user`. `uq_reset_link_token_digest` stays.

The upgrade runs with foreign keys off and puts the previous state back. The downgrade is
the exact mirror and restores the 0027 schema, names included. It turns foreign keys off
before its first write, as 0027 does, and does not put them back: it is the first step of
a walk down from head, and SQLite ignores `PRAGMA foreign_keys` once a write transaction
is open, so putting them back would turn enforcement on for 0023's rebuild of `sale`.
Every new connection sets the pragma on again in `app/db.py`.
"""

from collections.abc import Callable, Iterator, Sequence
from contextlib import contextmanager

import sqlalchemy as sa
from alembic import op

revision: str = "0028"
down_revision: str | None = "0027"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


class RebuildLostRows(RuntimeError):
    pass


class RebuildLeftBrokenReferences(RuntimeError):
    pass


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


def _rebuild(
    table: str,
    create_new: Callable[[str], None],
    create_indexes: Callable[[], None],
    new_columns: str,
    old_columns: str,
) -> None:
    scratch = f"_new_{table}"
    create_new(scratch)
    op.execute(f"INSERT INTO {scratch} ({new_columns}) SELECT {old_columns} FROM {table}")
    if _count(scratch) != _count(table):
        raise RebuildLostRows(table)
    op.drop_table(table)
    op.execute(f"ALTER TABLE {scratch} RENAME TO {table}")
    create_indexes()


def _create_expense(name: str) -> None:
    op.create_table(
        name,
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("business_id", sa.Integer(), nullable=False),
        sa.Column("expense_category_id", sa.Integer(), nullable=False),
        sa.Column("spent_on", sa.Date(), nullable=False),
        sa.Column("amount", sa.Integer(), nullable=False),
        sa.Column("detail", sa.String(length=200), nullable=False),
        sa.Column("recorded_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(
            ["business_id"], ["business.id"], name=op.f("fk_expense_business_id_business")
        ),
        sa.ForeignKeyConstraint(
            ["business_id", "expense_category_id"],
            ["expense_category.business_id", "expense_category.id"],
            name=op.f("fk_expense_business_id_expense_category"),
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_expense")),
    )


def _create_expense_indexes() -> None:
    op.create_index(
        op.f("ix_expense_business_id_expense_category_id"),
        "expense",
        ["business_id", "expense_category_id"],
    )
    op.create_index(op.f("ix_expense_business_id_spent_on"), "expense", ["business_id", "spent_on"])


def _create_old_expense(name: str) -> None:
    op.create_table(
        name,
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("business_id", sa.Integer(), nullable=False),
        sa.Column("category_id", sa.Integer(), nullable=False),
        sa.Column("spent_on", sa.Date(), nullable=False),
        sa.Column("amount", sa.Integer(), nullable=False),
        sa.Column("detail", sa.String(length=200), nullable=False),
        sa.Column("recorded_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(
            ["business_id"], ["business.id"], name=op.f("fk_expense_business_id_business")
        ),
        sa.ForeignKeyConstraint(
            ["business_id", "category_id"],
            ["expense_category.business_id", "expense_category.id"],
            name=op.f("fk_expense_business_id_expense_category"),
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_expense")),
    )


def _create_old_expense_indexes() -> None:
    op.create_index(
        op.f("ix_expense_business_id_category_id"), "expense", ["business_id", "category_id"]
    )
    op.create_index(op.f("ix_expense_business_id_spent_on"), "expense", ["business_id", "spent_on"])


def _create_reset_link(name: str) -> None:
    op.create_table(
        name,
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("business_id", sa.Integer(), nullable=False),
        sa.Column("app_user_id", sa.Integer(), nullable=False),
        sa.Column("token_digest", sa.String(length=64), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(
            ["app_user_id"], ["app_user.id"], name=op.f("fk_reset_link_app_user_id_app_user")
        ),
        sa.ForeignKeyConstraint(
            ["business_id"], ["business.id"], name=op.f("fk_reset_link_business_id_business")
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_reset_link")),
        sa.UniqueConstraint("app_user_id", name=op.f("uq_reset_link_app_user_id")),
        sa.UniqueConstraint("token_digest", name=op.f("uq_reset_link_token_digest")),
    )


def _create_old_reset_link(name: str) -> None:
    op.create_table(
        name,
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("business_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("token_digest", sa.String(length=64), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(
            ["business_id"], ["business.id"], name=op.f("fk_reset_link_business_id_business")
        ),
        sa.ForeignKeyConstraint(
            ["user_id"], ["app_user.id"], name=op.f("fk_reset_link_user_id_app_user")
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_reset_link")),
        sa.UniqueConstraint("user_id", name=op.f("uq_reset_link_user_id")),
        sa.UniqueConstraint("token_digest", name=op.f("uq_reset_link_token_digest")),
    )


def _no_indexes() -> None:
    """`reset_link` has no index of its own: its two unique constraints are its keys."""


def upgrade() -> None:
    with _foreign_keys_off():
        _rebuild(
            "expense",
            _create_expense,
            _create_expense_indexes,
            "id, business_id, expense_category_id, spent_on, amount, detail, recorded_at",
            "id, business_id, category_id, spent_on, amount, detail, recorded_at",
        )
        _rebuild(
            "reset_link",
            _create_reset_link,
            _no_indexes,
            "id, business_id, app_user_id, token_digest, created_at",
            "id, business_id, user_id, token_digest, created_at",
        )


def downgrade() -> None:
    raw = op.get_bind().connection.dbapi_connection
    assert raw is not None
    raw.execute("PRAGMA foreign_keys=OFF")
    _rebuild(
        "expense",
        _create_old_expense,
        _create_old_expense_indexes,
        "id, business_id, category_id, spent_on, amount, detail, recorded_at",
        "id, business_id, expense_category_id, spent_on, amount, detail, recorded_at",
    )
    _rebuild(
        "reset_link",
        _create_old_reset_link,
        _no_indexes,
        "id, business_id, user_id, token_digest, created_at",
        "id, business_id, app_user_id, token_digest, created_at",
    )
