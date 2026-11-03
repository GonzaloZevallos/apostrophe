"""Link every stock withdrawal to its reason (CONTEXT.md: Withdrawal reason).

Revision ID: 0021
Revises: 0020

Each withdrawal's `reason_id` is found from the old `reason` value by the `name_key`
revision 0020 wrote ('marketing' for 'promotion', 'own use' for 'own_use'), never by a
name a user can edit. A business that has withdrawals of a kind but no reason with that
key (it was opened after 0020 in another language, say) gets that default inserted at
the end of its list first, so the fill never fails and never leaves a gap. The names and
keys are literals, not imported from `app`; a test asserts each pair equals
`app.shared.names.name_key(name)`.

The old `reason` column is frozen, not read after this: it only becomes nullable, so new
rows leave it empty, and its check constraint stays as it is. Nothing in it is rewritten.
The column is added and filled first and the table is rebuilt once after, because a
batch rebuild copies rows and cannot compute a fill from another table.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0021"
down_revision: str | None = "0020"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# (legacy `reason` value, seeded name, seeded name_key)
LEGACY_REASONS = (
    ("promotion", "Marketing", "marketing"),
    ("own_use", "Own use", "own use"),
)


def upgrade() -> None:
    connection = op.get_bind()
    for legacy, name, key in LEGACY_REASONS:
        missing = (
            connection.execute(
                sa.text(
                    "SELECT DISTINCT w.business_id FROM stock_withdrawal w "
                    "WHERE w.reason = :legacy AND NOT EXISTS ("
                    "SELECT 1 FROM withdrawal_reason r "
                    "WHERE r.business_id = w.business_id AND r.name_key = :key)"
                ),
                {"legacy": legacy, "key": key},
            )
            .scalars()
            .all()
        )
        for business_id in missing:
            connection.execute(
                sa.text(
                    "INSERT INTO withdrawal_reason (business_id, name, name_key, position) "
                    "VALUES (:business_id, :name, :key, COALESCE("
                    "(SELECT MAX(position) FROM withdrawal_reason "
                    "WHERE business_id = :business_id), -1) + 1)"
                ),
                {"business_id": business_id, "name": name, "key": key},
            )

    op.add_column(
        "stock_withdrawal", sa.Column("withdrawal_reason_id", sa.Integer(), nullable=True)
    )
    for legacy, _name, key in LEGACY_REASONS:
        connection.execute(
            sa.text(
                "UPDATE stock_withdrawal SET withdrawal_reason_id = ("
                "SELECT r.id FROM withdrawal_reason r "
                "WHERE r.business_id = stock_withdrawal.business_id AND r.name_key = :key) "
                "WHERE reason = :legacy"
            ),
            {"legacy": legacy, "key": key},
        )

    with op.batch_alter_table("stock_withdrawal", recreate="always") as batch:
        batch.alter_column("withdrawal_reason_id", existing_type=sa.Integer(), nullable=False)
        batch.alter_column("reason", existing_type=sa.String(length=9), nullable=True)
        batch.create_foreign_key(
            op.f("fk_stock_withdrawal_business_id_withdrawal_reason"),
            "withdrawal_reason",
            ["business_id", "withdrawal_reason_id"],
            ["business_id", "id"],
            ondelete="RESTRICT",
        )
        batch.create_index(
            op.f("ix_stock_withdrawal_business_id_withdrawal_reason_id"),
            ["business_id", "withdrawal_reason_id"],
        )


def downgrade() -> None:
    with op.batch_alter_table("stock_withdrawal", recreate="always") as batch:
        batch.drop_index(op.f("ix_stock_withdrawal_business_id_withdrawal_reason_id"))
        batch.drop_constraint(
            op.f("fk_stock_withdrawal_business_id_withdrawal_reason"), type_="foreignkey"
        )
        batch.drop_column("withdrawal_reason_id")
        batch.alter_column("reason", existing_type=sa.String(length=9), nullable=False)
