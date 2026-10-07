"""Pricing settings and the VIP price (docs/adr/0031, docs/product/pricing-settings.md).

- `pricing_settings`: one row per business holding its two switches. Every business
  that exists now gets a row with both switches on, so nobody's pricing changes.
- `price_entry.vip_price`: an optional price per gram for VIP customers, no default,
  no check constraint (the rule is the domain's). Every entry that has a bulk price
  gets VIP price = bulk price, which is exactly what a VIP customer paid until now.

Revision ID: 0012
Revises: 0011
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0012"
down_revision: str | None = "0011"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "pricing_settings",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("business_id", sa.Integer(), nullable=False),
        sa.Column("is_bulk_pricing", sa.Boolean(), nullable=False),
        sa.Column("is_vip_customers", sa.Boolean(), nullable=False),
        sa.ForeignKeyConstraint(
            ["business_id"],
            ["business.id"],
            name=op.f("fk_pricing_settings_business_id_business"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_pricing_settings")),
        sa.UniqueConstraint("business_id", name=op.f("uq_pricing_settings_business_id")),
    )
    op.execute(
        "INSERT INTO pricing_settings (business_id, is_bulk_pricing, is_vip_customers) "
        "SELECT id, 1, 1 FROM business"
    )
    op.add_column("price_entry", sa.Column("vip_price", sa.Integer(), nullable=True))
    op.execute("UPDATE price_entry SET vip_price = bulk_price WHERE bulk_price IS NOT NULL")


def downgrade() -> None:
    # SQLite (and libsql) drop a plain, unconstrained column in place.
    op.drop_column("price_entry", "vip_price")
    op.drop_table("pricing_settings")
