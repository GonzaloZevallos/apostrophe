"""The `money_format` table: one row per business (CONTEXT.md: Money format), holding the
symbol and decimals its money is shown with and the scale its amount columns are stored
at (docs/adr/0058). Only this hexagon writes it (docs/adr/0034); `app/db.py`'s money
helper reads `scale` and nothing else does."""

from __future__ import annotations

from sqlalchemy import CheckConstraint, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class MoneyFormatRow(Base):
    __tablename__ = "money_format"
    # The short rule names only: NAMING_CONVENTION gives `ck_money_format_<name>`, and the
    # unique one below `uq_money_format_business_id`.
    __table_args__ = (
        CheckConstraint("scale IN (0, 2)", "scale"),
        CheckConstraint("decimals BETWEEN 0 AND 2", "decimals"),
        CheckConstraint("decimals <= scale", "decimals_within_scale"),
        CheckConstraint("trim(symbol) <> ''", "symbol"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    business_id: Mapped[int] = mapped_column(ForeignKey("business.id"), unique=True)
    symbol: Mapped[str] = mapped_column(String)
    decimals: Mapped[int]
    scale: Mapped[int]
