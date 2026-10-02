from datetime import date, datetime

from app.expenses.application.manage_categories import get_category
from app.expenses.application.ports import ExpenseCategories, Expenses
from app.expenses.domain.expense import Expense, ExpenseNotFound
from app.expenses.domain.month import Month
from app.expenses.domain.monthly_view import MonthlyExpenses
from app.shared.transaction import Transaction


def get_expense(expenses: Expenses, expense_id: int) -> Expense:
    expense = expenses.by_id(expense_id)
    if expense is None:
        raise ExpenseNotFound(expense_id)
    return expense


def record_expense(
    expenses: Expenses,
    categories: ExpenseCategories,
    transaction: Transaction,
    *,
    spent_on: date,
    category_id: int,
    amount: int,
    detail: str,
    today: date,
    recorded_at: datetime,
) -> Expense:
    """Checks run in this order: the category first (404), then the domain rules
    (422), so a foreign or unknown category never reaches the amount or date rules."""
    get_category(categories, category_id)
    expense = Expense.of(spent_on, category_id, amount, detail, today, recorded_at)
    stored = expenses.add(expense)
    transaction.commit()
    return stored


def edit_expense(
    expenses: Expenses,
    categories: ExpenseCategories,
    transaction: Transaction,
    expense_id: int,
    *,
    spent_on: date,
    category_id: int,
    amount: int,
    detail: str,
    today: date,
) -> Expense:
    """Checks run in this order: the expense (404), then the category (404), then the
    domain rules (422). `recorded_at` carries through from the stored expense: an edit
    never changes it."""
    existing = get_expense(expenses, expense_id)
    get_category(categories, category_id)
    updated = Expense.of(
        spent_on, category_id, amount, detail, today, existing.recorded_at, existing.id
    )
    stored = expenses.save(updated)
    transaction.commit()
    return stored


def delete_expense(expenses: Expenses, transaction: Transaction, expense_id: int) -> None:
    expense = get_expense(expenses, expense_id)
    assert expense.id is not None
    expenses.remove(expense.id)
    transaction.commit()


def monthly_view(expenses: Expenses, month: Month) -> MonthlyExpenses:
    """Totals come from what is stored, never from a cache: every call re-reads and
    re-sums the month's expenses."""
    return MonthlyExpenses.of(month, expenses.in_month(month))
