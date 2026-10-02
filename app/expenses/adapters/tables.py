from __future__ import annotations

from datetime import date, datetime

from sqlalchemy import Date, ForeignKey, ForeignKeyConstraint, Index, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base, UtcDateTime
from app.expenses.domain.category import NAME_MAX_LENGTH
from app.expenses.domain.expense import DETAIL_MAX_LENGTH


class ExpenseCategoryRow(Base):
    __tablename__ = "expense_category"
    # The casefolded name is what makes two names the same name, within one business.
    # The second constraint is what a composite FK from `expense` needs to point here.
    __table_args__ = (
        UniqueConstraint("business_id", "name_key"),
        UniqueConstraint("business_id", "id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    business_id: Mapped[int] = mapped_column(ForeignKey("business.id"))
    name: Mapped[str] = mapped_column(String(NAME_MAX_LENGTH))
    name_key: Mapped[str] = mapped_column(String(NAME_MAX_LENGTH))


class ExpenseRow(Base):
    __tablename__ = "expense"
    # The composite FK is the backstop for `ExpenseCategory.check_removable`: no
    # expense can ever be left pointing at a category removed out from under it, and a
    # category_id of another business can never be attached to this business's expense.
    __table_args__ = (
        ForeignKeyConstraint(
            ["business_id", "category_id"],
            ["expense_category.business_id", "expense_category.id"],
            ondelete="RESTRICT",
        ),
        Index("ix_expense_business_id_category_id", "business_id", "category_id"),
        Index("ix_expense_business_id_spent_on", "business_id", "spent_on"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    business_id: Mapped[int] = mapped_column(ForeignKey("business.id"))
    category_id: Mapped[int]
    spent_on: Mapped[date] = mapped_column(Date)
    amount: Mapped[int]
    detail: Mapped[str] = mapped_column(String(DETAIL_MAX_LENGTH))
    # Set once at creation from the injected clock; never changed by an edit.
    recorded_at: Mapped[datetime] = mapped_column(UtcDateTime)
