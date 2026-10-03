"""The catalog tables (CONTEXT.md: Catalog attributes, Catalog header and footer).
Every table carries `business_id`, not null, pointing at `business` (CODING_STANDARDS
section 9). `catalog_attributes` is unique per `(business_id, variety_id)`, the same
shape as `stock_threshold`; a variety without a row reads as `CatalogAttributes.default()`
(nothing here writes that default). `catalog_header_footer` is unique per `business_id`:
every business gets one row when it opens, never a second.
"""

from __future__ import annotations

from sqlalchemy import ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class CatalogAttributesRow(Base):
    __tablename__ = "catalog_attributes"
    __table_args__ = (UniqueConstraint("business_id", "variety_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    business_id: Mapped[int] = mapped_column(ForeignKey("business.id"))
    variety_id: Mapped[int] = mapped_column(ForeignKey("variety.id"))
    shown: Mapped[bool]
    emoji: Mapped[str | None] = mapped_column(String(64))
    indica_share: Mapped[int | None]
    aroma: Mapped[str | None] = mapped_column(String(200))


class CatalogHeaderFooterRow(Base):
    __tablename__ = "catalog_header_footer"

    id: Mapped[int] = mapped_column(primary_key=True)
    business_id: Mapped[int] = mapped_column(ForeignKey("business.id"), unique=True)
    header: Mapped[str] = mapped_column(String(500))
    footer: Mapped[str] = mapped_column(String(500))
