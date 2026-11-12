"""Database naming (CODING_STANDARDS §11): `catalog_attributes` becomes
`catalog_attribute` with `shown` renamed `is_shown`, and `customer.vip` becomes `is_vip`.

Revision ID: 0027
Revises: 0026

`customer.vip` is renamed in place (`RENAME COLUMN` rewrites only the schema text). No
index or constraint covers it, so `customer` is not rebuilt and the tables that point at
it are not at risk. Its value stays frozen (docs/adr/0059, docs/adr/0070).

SQLite cannot rename a table's constraints, so `catalog_attributes` is rebuilt: the new
table `catalog_attribute` is created with every name spelled for the new table (`op.f`
spells the final name), every row is copied with `shown` going into `is_shown`, the counts
are compared, and the old table is dropped. No table points at it. A count that differs
refuses with the table name only: never row data.

The upgrade runs with foreign keys off and puts the previous state back. The downgrade is
the exact mirror and restores the 0026 schema, names included. It turns foreign keys off
before its first write, as 0026 does, and does not put them back: it is the first step of
a walk down from head, and SQLite ignores `PRAGMA foreign_keys` once a write transaction
is open, so putting them back would turn enforcement on for 0023's rebuild of `sale`.
Every new connection sets the pragma on again in `app/db.py`.
"""

from collections.abc import Callable, Iterator, Sequence
from contextlib import contextmanager

import sqlalchemy as sa
from alembic import op

revision: str = "0027"
down_revision: str | None = "0026"
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
    old: str,
    new: str,
    create_new: Callable[[], None],
    new_columns: str,
    old_columns: str,
) -> None:
    create_new()
    op.execute(f"INSERT INTO {new} ({new_columns}) SELECT {old_columns} FROM {old}")
    if _count(new) != _count(old):
        raise RebuildLostRows(old)
    op.drop_table(old)


def _create_catalog_attribute() -> None:
    op.create_table(
        "catalog_attribute",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("business_id", sa.Integer(), nullable=False),
        sa.Column("variety_id", sa.Integer(), nullable=False),
        sa.Column("is_shown", sa.Boolean(), nullable=False),
        sa.Column("emoji", sa.String(length=64), nullable=True),
        sa.Column("indica_share", sa.Integer(), nullable=True),
        sa.Column("aroma", sa.String(length=200), nullable=True),
        sa.ForeignKeyConstraint(
            ["business_id"],
            ["business.id"],
            name=op.f("fk_catalog_attribute_business_id_business"),
        ),
        sa.ForeignKeyConstraint(
            ["variety_id"], ["variety.id"], name=op.f("fk_catalog_attribute_variety_id_variety")
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_catalog_attribute")),
        sa.UniqueConstraint(
            "business_id", "variety_id", name=op.f("uq_catalog_attribute_business_id_variety_id")
        ),
    )


def _create_catalog_attributes() -> None:
    op.create_table(
        "catalog_attributes",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("business_id", sa.Integer(), nullable=False),
        sa.Column("variety_id", sa.Integer(), nullable=False),
        sa.Column("shown", sa.Boolean(), nullable=False),
        sa.Column("emoji", sa.String(length=64), nullable=True),
        sa.Column("indica_share", sa.Integer(), nullable=True),
        sa.Column("aroma", sa.String(length=200), nullable=True),
        sa.ForeignKeyConstraint(
            ["business_id"],
            ["business.id"],
            name=op.f("fk_catalog_attributes_business_id_business"),
        ),
        sa.ForeignKeyConstraint(
            ["variety_id"], ["variety.id"], name=op.f("fk_catalog_attributes_variety_id_variety")
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_catalog_attributes")),
        sa.UniqueConstraint(
            "business_id", "variety_id", name=op.f("uq_catalog_attributes_business_id_variety_id")
        ),
    )


def upgrade() -> None:
    with _foreign_keys_off():
        op.execute("ALTER TABLE customer RENAME COLUMN vip TO is_vip")
        _rebuild(
            "catalog_attributes",
            "catalog_attribute",
            _create_catalog_attribute,
            "id, business_id, variety_id, is_shown, emoji, indica_share, aroma",
            "id, business_id, variety_id, shown, emoji, indica_share, aroma",
        )


def downgrade() -> None:
    raw = op.get_bind().connection.dbapi_connection
    assert raw is not None
    raw.execute("PRAGMA foreign_keys=OFF")
    _rebuild(
        "catalog_attribute",
        "catalog_attributes",
        _create_catalog_attributes,
        "id, business_id, variety_id, shown, emoji, indica_share, aroma",
        "id, business_id, variety_id, is_shown, emoji, indica_share, aroma",
    )
    op.execute("ALTER TABLE customer RENAME COLUMN is_vip TO vip")
