"""Customer-type prices (docs/adr/0059). This revision only adds: the `customer_type_price`
table and rows. It changes no value that existed before it.

- `customer_type_price`: `business_id`, `variety_id`, `customer_type_id`, `price` (an
  amount, stored at the business's money scale like every amount), `effective_on` and a
  nullable `entry_id`, the Price entry it was saved with. Unique per business, type,
  variety and day; indexed by business and entry for the lookup of the row tied to an
  entry. `entry_id` is a plain integer, not a foreign key (the name `price_entry_id`
  that a foreign key to `price_entry` needs is read as an amount by the money-name
  guard); nothing cascades: the code deletes the rows before the entry.
- One row for every `price_entry` with a `vip_price`, in a business that has its VIP type
  (`customer_type.is_vip`): the entry's business, variety, date and id, the VIP type's id
  and the amount copied raw (the same scale as the entry's). An entry of a business
  without a VIP type gets no row: no customer there can pay that price. A `vip_price`
  stays where it is, frozen.

Revision ID: 0029
Revises: 0028
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0029"
down_revision: str | None = "0028"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "customer_type_price",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("business_id", sa.Integer(), nullable=False),
        sa.Column("variety_id", sa.Integer(), nullable=False),
        sa.Column("customer_type_id", sa.Integer(), nullable=False),
        sa.Column("price", sa.Integer(), nullable=False),
        sa.Column("effective_on", sa.Date(), nullable=False),
        sa.Column("entry_id", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(
            ["business_id"],
            ["business.id"],
            name=op.f("fk_customer_type_price_business_id_business"),
        ),
        sa.ForeignKeyConstraint(
            ["variety_id"],
            ["variety.id"],
            name=op.f("fk_customer_type_price_variety_id_variety"),
        ),
        sa.ForeignKeyConstraint(
            ["customer_type_id"],
            ["customer_type.id"],
            name=op.f("fk_customer_type_price_customer_type_id_customer_type"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_customer_type_price")),
        sa.UniqueConstraint(
            "business_id",
            "customer_type_id",
            "variety_id",
            "effective_on",
            name=op.f(
                "uq_customer_type_price_business_id_customer_type_id_variety_id_effective_on"
            ),
        ),
    )
    op.create_index(
        op.f("ix_customer_type_price_business_id_entry_id"),
        "customer_type_price",
        ["business_id", "entry_id"],
    )
    op.execute(
        "INSERT INTO customer_type_price "
        "(business_id, variety_id, customer_type_id, price, effective_on, entry_id) "
        "SELECT price_entry.business_id, price_entry.variety_id, customer_type.id, "
        "price_entry.vip_price, price_entry.effective_on, price_entry.id "
        "FROM price_entry JOIN customer_type "
        "ON customer_type.business_id = price_entry.business_id AND customer_type.is_vip = 1 "
        "WHERE price_entry.vip_price IS NOT NULL"
    )


def downgrade() -> None:
    # The first step of a walk down from head: SQLite ignores `PRAGMA foreign_keys` once a
    # write transaction is open, so foreign keys go off before this step's first write,
    # as 0028 does, for the rebuilds of `sale` and `customer` further down. They are not
    # put back: every new connection sets the pragma on again in `app/db.py`.
    raw = op.get_bind().connection.dbapi_connection
    assert raw is not None
    raw.execute("PRAGMA foreign_keys=OFF")
    op.drop_index(
        op.f("ix_customer_type_price_business_id_entry_id"),
        table_name="customer_type_price",
    )
    op.drop_table("customer_type_price")
