from datetime import date

from pydantic import BaseModel

from app.expenses.domain.category import ExpenseCategory
from app.expenses.domain.expense import Expense
from app.expenses.domain.monthly_view import MonthlyExpenses


class CategoryIn(BaseModel):
    name: str


class CategoryOut(BaseModel):
    id: int
    name: str

    @classmethod
    def of(cls, category: ExpenseCategory) -> "CategoryOut":
        assert category.id is not None, "only stored categories go out"
        return cls(id=category.id, name=category.name.value)


class ExpenseIn(BaseModel):
    spent_on: date
    category_id: int
    amount: int
    detail: str


class ExpenseOut(BaseModel):
    id: int
    spent_on: date
    category_id: int
    amount: int
    detail: str

    @classmethod
    def of(cls, expense: Expense) -> "ExpenseOut":
        assert expense.id is not None, "only stored expenses go out"
        return cls(
            id=expense.id,
            spent_on=expense.spent_on,
            category_id=expense.category_id,
            amount=expense.amount,
            detail=expense.detail,
        )


class CategorySubtotalOut(BaseModel):
    id: int
    name: str
    subtotal: int
    expenses: list[ExpenseOut]


class MonthlyViewOut(BaseModel):
    month: str
    total: int
    categories: list[CategorySubtotalOut]

    @classmethod
    def of(cls, view: MonthlyExpenses) -> "MonthlyViewOut":
        return cls(
            month=str(view.month),
            total=view.total,
            categories=[
                CategorySubtotalOut(
                    id=category.category_id,
                    name=category.name,
                    subtotal=category.subtotal,
                    expenses=[ExpenseOut.of(e) for e in category.expenses],
                )
                for category in view.categories
            ],
        )
