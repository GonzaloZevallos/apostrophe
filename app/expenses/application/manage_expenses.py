from datetime import date, datetime
from decimal import Decimal

from app.expenses.application.manage_categories import get_category
from app.expenses.application.ports import ExpenseCategories, Expenses, MoneyFormatReader
from app.expenses.domain.expense import Expense, ExpenseNotFound
from app.expenses.domain.month import Month
from app.expenses.domain.monthly_view import MonthlyExpenses
from app.shared.money import domain_amount_within
from app.shared.transaction import Transaction


def _whole_amount(money_format: MoneyFormatReader, amount: Decimal) -> int:
    return domain_amount_within(amount, money_format.current())


def get_expense(expenses: Expenses, expense_id: int) -> Expense:
    expense = expenses.by_id(expense_id)
    if expense is None:
        raise ExpenseNotFound(expense_id)
    return expense


def record_expense(
    expenses: Expenses,
    categories: ExpenseCategories,
    money_format: MoneyFormatReader,
    transaction: Transaction,
    *,
    spent_on: date,
    category_id: int,
    amount: Decimal,
    detail: str,
    today: date,
    recorded_at: datetime,
) -> Expense:
    """Checks run in this order: the amount's decimals against the business's own
    (docs/adr/0058, 422, before any read), the category (404), then the domain rules
    (422), so a foreign or unknown category never reaches the amount or date rules."""
    whole = _whole_amount(money_format, amount)
    get_category(categories, category_id)
    expense = Expense.of(spent_on, category_id, whole, detail, today, recorded_at)
    stored = expenses.add(expense)
    transaction.commit()
    return stored


def edit_expense(
    expenses: Expenses,
    categories: ExpenseCategories,
    money_format: MoneyFormatReader,
    transaction: Transaction,
    expense_id: int,
    *,
    spent_on: date,
    category_id: int,
    amount: Decimal,
    detail: str,
    today: date,
) -> Expense:
    """Checks run in this order: the amount's decimals (422), the expense (404), the
    category (404), then the domain rules (422). `recorded_at` carries through from the
    stored expense: an edit never changes it."""
    whole = _whole_amount(money_format, amount)
    existing = get_expense(expenses, expense_id)
    get_category(categories, category_id)
    updated = Expense.of(
        spent_on, category_id, whole, detail, today, existing.recorded_at, existing.id
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
