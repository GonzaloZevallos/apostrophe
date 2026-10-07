"""The `pricing_settings` table: one row per business (CONTEXT.md: Pricing settings),
holding the two switches. Only this hexagon writes it (docs/adr/0031)."""

from __future__ import annotations

from sqlalchemy import ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class PricingSettingsRow(Base):
    __tablename__ = "pricing_settings"

    id: Mapped[int] = mapped_column(primary_key=True)
    business_id: Mapped[int] = mapped_column(ForeignKey("business.id"), unique=True)
    is_bulk_pricing: Mapped[bool]
    is_vip_customers: Mapped[bool]
