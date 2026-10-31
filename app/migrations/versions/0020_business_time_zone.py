"""Store a time zone on every business (docs/adr/0057). The column is added with a server
default of `'America/Argentina/Buenos_Aires'`, which also fills every existing row with the
zone those businesses already lived by, and the default stays: a business opened without
naming a zone is an Argentine one. No check constraint: whether a name is a zone is the
installed IANA data's question, not the schema's. No pre-existing column value changes
(tests/migrations/m3.py proves it). The downgrade drops the column natively.

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

DEFAULT_ZONE = "America/Argentina/Buenos_Aires"


def upgrade() -> None:
    with op.batch_alter_table("business") as batch:
        batch.add_column(
            sa.Column(
                "time_zone", sa.String(length=64), nullable=False, server_default=DEFAULT_ZONE
            )
        )


def downgrade() -> None:
    # A native `DROP COLUMN`, as in 0018 and 0019: no table rebuild, so no foreign key is
    # touched.
    op.drop_column("business", "time_zone")
