"""The withdrawal reasons of a business (CONTEXT.md: Withdrawal reason).

Revision ID: 0020
Revises: 0019

Adds the table and gives every business that already exists the two defaults, English
(an existing business's stored language is English), at positions 0 and 1. The names and
their `name_key`s are literals, not imported from `app`: a revision must not change
behaviour if the domain ever does. A test asserts each pair equals
`app.shared.names.name_key(name)`. Nothing that existed is changed, and nothing links a
withdrawal to its reason yet: a later revision does, by the `name_key` written here.
Every business is seeded, including one with no withdrawals; this runs once, so a
default a business later deletes is never restored.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0020"
down_revision: str | None = "0019"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

DEFAULT_REASONS = (
    ("Marketing", "marketing", 0),
    ("Own use", "own use", 1),
)


def upgrade() -> None:
    op.create_table(
        "withdrawal_reason",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("business_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=60), nullable=False),
        sa.Column("name_key", sa.String(length=60), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(
            ["business_id"], ["business.id"], name=op.f("fk_withdrawal_reason_business_id_business")
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_withdrawal_reason")),
        sa.UniqueConstraint(
            "business_id", "name_key", name=op.f("uq_withdrawal_reason_business_id_name_key")
        ),
        sa.UniqueConstraint("business_id", "id", name=op.f("uq_withdrawal_reason_business_id_id")),
    )
    withdrawal_reason = sa.table(
        "withdrawal_reason",
        sa.column("business_id", sa.Integer()),
        sa.column("name", sa.String()),
        sa.column("name_key", sa.String()),
        sa.column("position", sa.Integer()),
    )
    business = sa.table("business", sa.column("id", sa.Integer()))
    for name, name_key, position in DEFAULT_REASONS:
        op.execute(
            withdrawal_reason.insert().from_select(
                ["business_id", "name", "name_key", "position"],
                sa.select(
                    business.c.id, sa.literal(name), sa.literal(name_key), sa.literal(position)
                ),
            )
        )


def downgrade() -> None:
    op.drop_table("withdrawal_reason")
