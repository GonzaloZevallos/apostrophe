"""The monthly view (CONTEXT.md: Monthly view): a month's total, broken down by
category, each with its subtotal and the expenses filed under it.

The total and every subtotal are summed here, from the expenses the repository
returns for the month; no SQL aggregate computes an amount. A category with no
expenses that month is left out, and the categories that remain are sorted by name.
"""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass

from app.expenses.domain.expense import Expense
from app.expenses.domain.month import Month


@dataclass(frozen=True)
class CategorizedExpense:
    """One expense, paired with the name of the category it was filed under at the
    time of this read. `name_key` is what groups and orders categories; `category_id`
    and `name` are what the view shows."""

    expense: Expense
    category_name: str
    category_name_key: str


@dataclass(frozen=True)
class CategorySubtotal:
    category_id: int
    name: str
    subtotal: int
    expenses: tuple[Expense, ...]


@dataclass(frozen=True)
class MonthlyExpenses:
    month: Month
    total: int
    categories: tuple[CategorySubtotal, ...]

    @classmethod
    def of(cls, month: Month, categorized: Sequence[CategorizedExpense]) -> MonthlyExpenses:
        groups: dict[str, list[CategorizedExpense]] = {}
        for entry in categorized:
            groups.setdefault(entry.category_name_key, []).append(entry)
        categories = tuple(
            CategorySubtotal(
                category_id=group[0].expense.category_id,
                name=group[0].category_name,
                subtotal=sum(entry.expense.amount for entry in group),
                expenses=tuple(entry.expense for entry in group),
            )
            for _, group in sorted(groups.items())
        )
        total = sum(entry.expense.amount for entry in categorized)
        return cls(month=month, total=total, categories=categories)
