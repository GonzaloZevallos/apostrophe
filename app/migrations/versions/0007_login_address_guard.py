"""The per-address login brake (docs/adr/0002, CODING_STANDARDS section 9): a platform
table, keyed by the HMAC digest of the client address, never the raw IP.

Revision ID: 0007
Revises: 0006
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0007"
down_revision: str | None = "0006"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "login_address_guard",
        sa.Column("address_digest", sa.String(length=64), nullable=False),
        sa.Column("failures", sa.Integer(), nullable=False),
        sa.Column("window_start", sa.DateTime(), nullable=False),
        sa.Column("locked_until", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("address_digest", name=op.f("pk_login_address_guard")),
    )


def downgrade() -> None:
    op.drop_table("login_address_guard")
