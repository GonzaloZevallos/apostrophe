from __future__ import annotations

from sqlalchemy import CheckConstraint, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base
from app.units.domain.unit import LABEL_MAX_LENGTH, NAME_MAX_LENGTH


class UnitRow(Base):
    __tablename__ = "unit"
    # The casefolded name is what makes two names the same name, within one business.
    __table_args__ = (
        CheckConstraint("decimals BETWEEN 0 AND 2", name="decimals_range"),
        UniqueConstraint("business_id", "name_key"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    business_id: Mapped[int] = mapped_column(ForeignKey("business.id"))
    name: Mapped[str] = mapped_column(String(NAME_MAX_LENGTH))
    name_key: Mapped[str] = mapped_column(String(NAME_MAX_LENGTH))
    label: Mapped[str] = mapped_column(String(LABEL_MAX_LENGTH))
    decimals: Mapped[int]
