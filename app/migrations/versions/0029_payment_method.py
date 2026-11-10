"""The payment methods of a business (CONTEXT.md: Payment method; docs/adr/0082).

Revision ID: 0029
Revises: 0028

Adds the table and gives every business that already exists the two defaults, English (an
existing business's stored language is English), at positions 1 and 2. The names, keys and
icons are literals, not imported from `app`: a revision must not change behaviour if the
domain ever does. A test asserts each key equals what `PaymentMethodName` derives. Nothing
that existed is changed, and nothing links a payment to its method yet: revision 0030 does,
by the `name_key` written here. Every business is seeded, including one with no payments.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

from app.db import UtcDateTime

revision: str = "0029"
down_revision: str | None = "0028"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

DEFAULT_METHODS = (
    ("Cash", "cash", "banknote", 1),
    ("Transfer", "transfer", "bank", 2),
)


def upgrade() -> None:
    op.create_table(
        "payment_method",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("business_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=60), nullable=False),
        sa.Column("name_key", sa.String(length=60), nullable=False),
        sa.Column("icon", sa.String(length=16), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("archived_at", UtcDateTime(), nullable=True),
        sa.ForeignKeyConstraint(
            ["business_id"], ["business.id"], name=op.f("fk_payment_method_business_id_business")
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_payment_method")),
        sa.UniqueConstraint(
            "business_id", "name_key", name=op.f("uq_payment_method_business_id_name_key")
        ),
        sa.UniqueConstraint("business_id", "id", name=op.f("uq_payment_method_business_id_id")),
    )
    payment_method = sa.table(
        "payment_method",
        sa.column("business_id", sa.Integer()),
        sa.column("name", sa.String()),
        sa.column("name_key", sa.String()),
        sa.column("icon", sa.String()),
        sa.column("position", sa.Integer()),
    )
    business = sa.table("business", sa.column("id", sa.Integer()))
    for name, key, icon, position in DEFAULT_METHODS:
        op.execute(
            payment_method.insert().from_select(
                ["business_id", "name", "name_key", "icon", "position"],
                sa.select(
                    business.c.id,
                    sa.literal(name),
                    sa.literal(key),
                    sa.literal(icon),
                    sa.literal(position),
                ),
            )
        )


def downgrade() -> None:
    # The first downgrade a walk from head runs. Foreign keys go off before its first write,
    # the way 0028 does: SQLite ignores the pragma inside a write transaction, and the later
    # downgrades that rebuild a table (0023) need it already off.
    raw = op.get_bind().connection.dbapi_connection
    assert raw is not None
    raw.execute("PRAGMA foreign_keys=OFF")
    op.drop_table("payment_method")
