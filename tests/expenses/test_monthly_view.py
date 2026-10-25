"""`MonthlyExpenses.of` with no infrastructure (CODING_STANDARDS §5): the total and
every subtotal are summed here, from the expenses handed in, never by a database."""

from datetime import UTC, date, datetime

from app.expenses.domain.expense import Expense
from app.expenses.domain.month import Month
from app.expenses.domain.monthly_view import CategorizedExpense, MonthlyExpenses

MONTH = Month(2026, 10)


def _entry(category_id: int, name: str, amount: int, id: int) -> CategorizedExpense:
    expense = Expense(
        spent_on=date(2026, 10, 1),
        category_id=category_id,
        amount=amount,
        detail="algo",
        recorded_at=datetime(2026, 10, 1, tzinfo=UTC),
        id=id,
    )
    return CategorizedExpense(expense, name, name.casefold())


def test_a_month_with_no_expenses_has_a_zero_total_and_no_categories() -> None:
    view = MonthlyExpenses.of(MONTH, [])

    assert view.total == 0
    assert view.categories == ()


def test_the_total_is_the_sum_of_every_expense() -> None:
    view = MonthlyExpenses.of(
        MONTH, [_entry(1, "Otros", 100, 1), _entry(2, "Packaging", 250, 2)]
    )

    assert view.total == 350


def test_each_categorys_subtotal_is_the_sum_of_its_own_expenses() -> None:
    view = MonthlyExpenses.of(
        MONTH,
        [_entry(1, "Otros", 100, 1), _entry(1, "Otros", 50, 2), _entry(2, "Packaging", 250, 3)],
    )

    otros = next(c for c in view.categories if c.name == "Otros")
    packaging = next(c for c in view.categories if c.name == "Packaging")
    assert otros.subtotal == 150
    assert len(otros.expenses) == 2
    assert packaging.subtotal == 250


def test_categories_are_sorted_by_name() -> None:
    view = MonthlyExpenses.of(
        MONTH, [_entry(2, "Packaging", 1, 1), _entry(1, "Insumos", 1, 2)]
    )

    assert [c.name for c in view.categories] == ["Insumos", "Packaging"]
