"""Customer types (docs/adr/0059, docs/adr/0070). This revision only adds: the
`customer_type` table, a nullable `customer.customer_type_id`, and rows. It changes no
value that existed before it.

- `customer_type`: `business_id` (not null), `name`, its folded `name_key`, `icon` and
  `is_vip`. A partial unique index allows at most one VIP type per business.
- `customer.customer_type_id`: nullable, a foreign key with no cascade, indexed.
- `customer.vip` is frozen (kept with its values, no longer read) and only gains a
  server default of false, so a row written without it still stores a value.
- One type named "VIP" (icon `star`, `is_vip` true) for every business that exists,
  and its id on every customer with `vip` set. A business created later starts with none.

Revision ID: 0020
Revises: 0019
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0020"
down_revision: str | None = "0019"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "customer_type",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("business_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=40), nullable=False),
        sa.Column("name_key", sa.String(length=40), nullable=False),
        sa.Column("icon", sa.String(length=16), nullable=False),
        sa.Column("is_vip", sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.ForeignKeyConstraint(
            ["business_id"], ["business.id"], name=op.f("fk_customer_type_business_id_business")
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_customer_type")),
        sa.UniqueConstraint(
            "business_id", "name_key", name=op.f("uq_customer_type_business_id_name_key")
        ),
    )
    op.create_index(
        op.f("ix_customer_type_business_id"),
        "customer_type",
        ["business_id"],
        unique=True,
        sqlite_where=sa.text("is_vip"),
    )

    # A rebuild of `customer` (SQLite cannot add a foreign key in place) that keeps
    # `uq_customer_business_phone`: batch mode reflects it from the table's own SQL.
    with op.batch_alter_table("customer", recreate="always") as batch:
        batch.add_column(sa.Column("customer_type_id", sa.Integer(), nullable=True))
        batch.create_foreign_key(
            op.f("fk_customer_customer_type_id_customer_type"),
            "customer_type",
            ["customer_type_id"],
            ["id"],
        )
        batch.create_index(op.f("ix_customer_customer_type_id"), ["customer_type_id"])
        batch.alter_column(
            "vip",
            existing_type=sa.Boolean(),
            existing_nullable=False,
            server_default=sa.false(),
        )

    op.execute(
        "INSERT INTO customer_type (business_id, name, name_key, icon, is_vip) "
        "SELECT id, 'VIP', 'vip', 'star', 1 FROM business"
    )
    op.execute(
        "UPDATE customer SET customer_type_id = ("
        "SELECT customer_type.id FROM customer_type "
        "WHERE customer_type.business_id = customer.business_id AND customer_type.is_vip = 1"
        ") WHERE vip = 1"
    )


def downgrade() -> None:
    # Rebuilding `customer` drops the old copy while sales and payments point at it, so
    # foreign keys are off for the rebuild, as the upgrade runner does (the pragma is a
    # no-op once a transaction has written, so nothing is written before it).
    dbapi_connection = op.get_bind().connection.dbapi_connection
    assert dbapi_connection is not None
    was_on = dbapi_connection.execute("PRAGMA foreign_keys").fetchone()[0]
    dbapi_connection.execute("PRAGMA foreign_keys=OFF")
    with op.batch_alter_table("customer", recreate="always") as batch:
        batch.drop_index(op.f("ix_customer_customer_type_id"))
        batch.drop_constraint(
            op.f("fk_customer_customer_type_id_customer_type"), type_="foreignkey"
        )
        batch.drop_column("customer_type_id")
        batch.alter_column(
            "vip",
            existing_type=sa.Boolean(),
            existing_nullable=False,
            server_default=None,
        )
    op.drop_index(
        op.f("ix_customer_type_business_id"),
        table_name="customer_type",
        sqlite_where=sa.text("is_vip"),
    )
    op.drop_table("customer_type")
    dbapi_connection.execute(f"PRAGMA foreign_keys={'ON' if was_on else 'OFF'}")
