"""Catalog attributes and the catalog header and footer, per business (CONTEXT.md:
Catalog attributes, Catalog header and footer).

Revision ID: 0006
Revises: 0005

The literal default header and footer are inserted here for every business that
already exists, as literals rather than imported from
`app.catalog.domain.header_footer`, the way 0003 seeds expense categories: a revision
must not change behaviour if the domain constant ever does. No attribute rows are
inserted: a variety without one already reads as `CatalogAttributes.default()` (shown,
nothing filled in), so every existing variety is shown on upgrade without a single row
written for it.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0006"
down_revision: str | None = "0005"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

DEFAULT_HEADER = "\U0001f33f **CATÁLOGO** \U0001f33f"
DEFAULT_FOOTER = "\U0001f4e9 Consultas y pedidos por privado."


def upgrade() -> None:
    op.create_table(
        "catalog_attributes",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("business_id", sa.Integer(), nullable=False),
        sa.Column("variety_id", sa.Integer(), nullable=False),
        sa.Column("shown", sa.Boolean(), nullable=False),
        sa.Column("emoji", sa.String(length=64), nullable=True),
        sa.Column("indica_share", sa.Integer(), nullable=True),
        sa.Column("aroma", sa.String(length=200), nullable=True),
        sa.ForeignKeyConstraint(
            ["business_id"],
            ["business.id"],
            name=op.f("fk_catalog_attributes_business_id_business"),
        ),
        sa.ForeignKeyConstraint(
            ["variety_id"], ["variety.id"], name=op.f("fk_catalog_attributes_variety_id_variety")
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_catalog_attributes")),
        sa.UniqueConstraint(
            "business_id", "variety_id", name=op.f("uq_catalog_attributes_business_id_variety_id")
        ),
    )
    op.create_table(
        "catalog_header_footer",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("business_id", sa.Integer(), nullable=False),
        sa.Column("header", sa.String(length=500), nullable=False),
        sa.Column("footer", sa.String(length=500), nullable=False),
        sa.ForeignKeyConstraint(
            ["business_id"],
            ["business.id"],
            name=op.f("fk_catalog_header_footer_business_id_business"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_catalog_header_footer")),
        sa.UniqueConstraint(
            "business_id", name=op.f("uq_catalog_header_footer_business_id")
        ),
    )

    catalog_header_footer = sa.table(
        "catalog_header_footer",
        sa.column("business_id", sa.Integer()),
        sa.column("header", sa.String()),
        sa.column("footer", sa.String()),
    )
    business = sa.table("business", sa.column("id", sa.Integer()))
    op.execute(
        catalog_header_footer.insert().from_select(
            ["business_id", "header", "footer"],
            sa.select(business.c.id, sa.literal(DEFAULT_HEADER), sa.literal(DEFAULT_FOOTER)),
        )
    )


def downgrade() -> None:
    op.drop_table("catalog_header_footer")
    op.drop_table("catalog_attributes")
