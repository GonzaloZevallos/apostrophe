"""Expense categories and expenses.

Revision ID: 0003
Revises: 0002

The four default category names are inserted here, for every business that already
exists, as literals rather than imported from `app.expenses.domain.category`: a
revision must not change behaviour if the domain constant ever does. This runs once,
inside this revision; no other code path seeds defaults, so a default a business later
removes is never restored (PM, round 1).
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0003"
down_revision: str | None = "0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

DEFAULT_CATEGORIES = (
    ("Insumos de cultivo", "insumos de cultivo"),
    ("Packaging", "packaging"),
    ("Envíos y traslados", "envíos y traslados"),
    ("Otros", "otros"),
)


def upgrade() -> None:
    op.create_table(
        "expense_category",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("business_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=60), nullable=False),
        sa.Column("name_key", sa.String(length=60), nullable=False),
        sa.ForeignKeyConstraint(
            ["business_id"],
            ["business.id"],
            name=op.f("fk_expense_category_business_id_business"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_expense_category")),
        sa.UniqueConstraint(
            "business_id", "name_key", name=op.f("uq_expense_category_business_id_name_key")
        ),
        sa.UniqueConstraint("business_id", "id", name=op.f("uq_expense_category_business_id_id")),
    )
    op.create_table(
        "expense",
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
    op.create_index("ix_expense_business_id_category_id", "expense", ["business_id", "category_id"])
    op.create_index("ix_expense_business_id_spent_on", "expense", ["business_id", "spent_on"])

    expense_category = sa.table(
        "expense_category",
        sa.column("business_id", sa.Integer()),
        sa.column("name", sa.String()),
        sa.column("name_key", sa.String()),
    )
    business = sa.table("business", sa.column("id", sa.Integer()))
    for name, name_key in DEFAULT_CATEGORIES:
        op.execute(
            expense_category.insert().from_select(
                ["business_id", "name", "name_key"],
                sa.select(business.c.id, sa.literal(name), sa.literal(name_key)),
            )
        )


def downgrade() -> None:
    op.drop_index("ix_expense_business_id_spent_on", table_name="expense")
    op.drop_index("ix_expense_business_id_category_id", table_name="expense")
    op.drop_table("expense")
    op.drop_table("expense_category")
