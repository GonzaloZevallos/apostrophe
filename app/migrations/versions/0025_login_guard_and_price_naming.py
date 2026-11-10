"""Database naming (CODING_STANDARDS §11, docs/adr/0077): the login guard tables get a
surrogate `id`, and four names are fixed.

Revision ID: 0025
Revises: 0024

`login_guard` and `login_address_guard` get an integer primary key `id` and stay keyed by
`email` / `address_digest` through a unique constraint, the upsert's conflict target.
`locked_until` becomes `unlocks_at` in both, and `window_start` becomes
`window_started_at`. `price_entry.effective_from` becomes `effective_on` with its unique
constraint, and `uq_customer_business_phone` becomes `uq_customer_business_id_phone`.

SQLite cannot give a table a new primary key in place, so each guard table is rebuilt by
copying it (the ids are assigned by SQLite and carry no meaning or order); the other two
tables go through batch mode. Each rebuild compares the row count before and after, and
refuses with the table name only: never row data. The downgrade restores the 0024 schema,
names included. The runner has foreign keys off while it runs.
"""

from collections.abc import Callable, Iterator, Sequence
from contextlib import contextmanager

import sqlalchemy as sa
from alembic import op

revision: str = "0025"
down_revision: str | None = "0024"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


class RebuildLostRows(RuntimeError):
    pass


class RebuildLeftBrokenReferences(RuntimeError):
    pass


@contextmanager
def _foreign_keys_off() -> Iterator[None]:
    """Rebuilding `customer` or `price_entry` drops a table other tables point at. The
    runner has foreign keys off already; a caller that does not gets them off here,
    before the first write of the step (SQLite ignores the pragma inside a write
    transaction), and the check below stands in for the enforcement it lost."""
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


def _same_count_after(table: str, rebuild: Callable[[], None]) -> None:
    before = _count(table)
    rebuild()
    if _count(table) != before:
        raise RebuildLostRows(table)


def _copy_into_new(
    table: str, create_new: Callable[[str], None], columns: str, source_columns: str
) -> None:
    """Rebuilds `table` through `<table>_new`: create, copy every row, check the count,
    drop the old one, rename the new one into its place."""
    new_table = f"{table}_new"
    create_new(new_table)
    op.execute(f"INSERT INTO {new_table} ({columns}) SELECT {source_columns} FROM {table}")
    if _count(new_table) != _count(table):
        raise RebuildLostRows(table)
    op.drop_table(table)
    op.rename_table(new_table, table)


def _create_login_guard_0025(name: str) -> None:
    op.create_table(
        name,
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("email", sa.String(length=254), nullable=False),
        sa.Column("failures", sa.Integer(), nullable=False),
        sa.Column("unlocks_at", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_login_guard")),
        sa.UniqueConstraint("email", name=op.f("uq_login_guard_email")),
    )


def _create_login_guard_0024(name: str) -> None:
    op.create_table(
        name,
        sa.Column("email", sa.String(length=254), nullable=False),
        sa.Column("failures", sa.Integer(), nullable=False),
        sa.Column("locked_until", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("email", name=op.f("pk_login_guard")),
    )


def _create_login_address_guard_0025(name: str) -> None:
    op.create_table(
        name,
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("address_digest", sa.String(length=64), nullable=False),
        sa.Column("failures", sa.Integer(), nullable=False),
        sa.Column("window_started_at", sa.DateTime(), nullable=False),
        sa.Column("unlocks_at", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_login_address_guard")),
        sa.UniqueConstraint("address_digest", name=op.f("uq_login_address_guard_address_digest")),
    )


def _create_login_address_guard_0024(name: str) -> None:
    op.create_table(
        name,
        sa.Column("address_digest", sa.String(length=64), nullable=False),
        sa.Column("failures", sa.Integer(), nullable=False),
        sa.Column("window_start", sa.DateTime(), nullable=False),
        sa.Column("locked_until", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("address_digest", name=op.f("pk_login_address_guard")),
    )


def _upgrade() -> None:
    _copy_into_new(
        "login_guard",
        _create_login_guard_0025,
        "email, failures, unlocks_at",
        "email, failures, locked_until",
    )
    _copy_into_new(
        "login_address_guard",
        _create_login_address_guard_0025,
        "address_digest, failures, window_started_at, unlocks_at",
        "address_digest, failures, window_start, locked_until",
    )

    def rename_effective_from() -> None:
        # Two rebuilds: a constraint added in the batch that renames its column is
        # silently dropped.
        with op.batch_alter_table("price_entry", recreate="always") as batch:
            batch.drop_constraint("uq_price_entry_variety_id_effective_from", type_="unique")
            batch.alter_column(
                "effective_from", new_column_name="effective_on", existing_type=sa.Date()
            )
        with op.batch_alter_table("price_entry", recreate="always") as batch:
            batch.create_unique_constraint(
                op.f("uq_price_entry_variety_id_effective_on"), ["variety_id", "effective_on"]
            )

    _same_count_after("price_entry", rename_effective_from)

    def rename_phone_constraint() -> None:
        with op.batch_alter_table("customer", recreate="always") as batch:
            batch.drop_constraint("uq_customer_business_phone", type_="unique")
            batch.create_unique_constraint(
                op.f("uq_customer_business_id_phone"), ["business_id", "phone"]
            )

    _same_count_after("customer", rename_phone_constraint)


def _downgrade() -> None:
    def restore_phone_constraint() -> None:
        with op.batch_alter_table("customer", recreate="always") as batch:
            batch.drop_constraint("uq_customer_business_id_phone", type_="unique")
            batch.create_unique_constraint(
                op.f("uq_customer_business_phone"), ["business_id", "phone"]
            )

    _same_count_after("customer", restore_phone_constraint)

    def restore_effective_from() -> None:
        with op.batch_alter_table("price_entry", recreate="always") as batch:
            batch.drop_constraint("uq_price_entry_variety_id_effective_on", type_="unique")
            batch.alter_column(
                "effective_on", new_column_name="effective_from", existing_type=sa.Date()
            )
        with op.batch_alter_table("price_entry", recreate="always") as batch:
            batch.create_unique_constraint(
                op.f("uq_price_entry_variety_id_effective_from"),
                ["variety_id", "effective_from"],
            )

    _same_count_after("price_entry", restore_effective_from)

    _copy_into_new(
        "login_address_guard",
        _create_login_address_guard_0024,
        "address_digest, failures, window_start, locked_until",
        "address_digest, failures, window_started_at, unlocks_at",
    )
    _copy_into_new(
        "login_guard",
        _create_login_guard_0024,
        "email, failures, locked_until",
        "email, failures, unlocks_at",
    )


def upgrade() -> None:
    with _foreign_keys_off():
        _upgrade()


def downgrade() -> None:
    with _foreign_keys_off():
        _downgrade()
