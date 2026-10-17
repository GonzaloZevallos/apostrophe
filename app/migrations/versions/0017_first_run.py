"""The first-run facts (CONTEXT.md: first-run checklist; ADR-0046): one `first_run` row
per business that has one, carrying only when the checklist went for good, when the
spreadsheet import loaded the business and when the after-import notice was over. No
checklist step is stored. No backfill: a business imported before has no row.

Revision ID: 0017
Revises: 0016
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0017"
down_revision: str | None = "0016"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "first_run",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("business_id", sa.Integer(), nullable=False),
        sa.Column("checklist_gone_at", sa.DateTime(), nullable=True),
        sa.Column("imported_at", sa.DateTime(), nullable=True),
        sa.Column("import_notice_over_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(
            ["business_id"], ["business.id"], name=op.f("fk_first_run_business_id_business")
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_first_run")),
        sa.UniqueConstraint("business_id", name=op.f("uq_first_run_business_id")),
    )


def downgrade() -> None:
    op.drop_table("first_run")
