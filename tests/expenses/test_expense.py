"""`Expense.of` with no infrastructure (CODING_STANDARDS §5)."""

from datetime import UTC, date, datetime

import pytest

from app.expenses.domain.expense import (
    AMOUNT_MAX,
    Expense,
    InvalidAmount,
    InvalidDetail,
    InvalidExpenseDate,
)

TODAY = date(2026, 10, 2)
RECORDED_AT = datetime(2026, 10, 2, 18, 0, tzinfo=UTC)


def _expense(
    spent_on: date = TODAY,
    category_id: int = 1,
    amount: int = 1_000,
    detail: str = "fletes de octubre",
    today: date = TODAY,
    recorded_at: datetime = RECORDED_AT,
    id: int | None = None,
) -> Expense:
    return Expense.of(spent_on, category_id, amount, detail, today, recorded_at, id)


def test_an_expense_with_valid_fields_is_built() -> None:
    expense = _expense()

    assert expense.spent_on == TODAY
    assert expense.amount == 1_000
    assert expense.detail == "fletes de octubre"
    assert expense.recorded_at == RECORDED_AT


def test_a_date_after_today_is_refused() -> None:
    with pytest.raises(InvalidExpenseDate, match="not dated after today"):
        _expense(spent_on=date(2026, 10, 3))


def test_todays_date_is_accepted() -> None:
    assert _expense(spent_on=TODAY).spent_on == TODAY


@pytest.mark.parametrize("amount", [0, -1])
def test_an_amount_that_is_not_positive_is_refused(amount: int) -> None:
    with pytest.raises(InvalidAmount, match="above zero"):
        _expense(amount=amount)


def test_an_amount_over_the_maximum_is_refused() -> None:
    with pytest.raises(InvalidAmount, match=f"at most {AMOUNT_MAX} pesos"):
        _expense(amount=AMOUNT_MAX + 1)


def test_an_amount_at_the_maximum_is_accepted() -> None:
    assert _expense(amount=AMOUNT_MAX).amount == AMOUNT_MAX


@pytest.mark.parametrize("detail", ["", "   "])
def test_a_blank_detail_is_refused(detail: str) -> None:
    with pytest.raises(InvalidDetail, match="a detail is required"):
        _expense(detail=detail)


def test_a_detail_is_trimmed() -> None:
    assert _expense(detail="  una entrega  ").detail == "una entrega"


def test_a_detail_over_the_limit_is_refused() -> None:
    with pytest.raises(InvalidDetail, match="at most 200 characters"):
        _expense(detail="x" * 201)


def test_a_detail_at_the_limit_is_accepted() -> None:
    assert _expense(detail="x" * 200).detail == "x" * 200


def test_editing_keeps_the_id_and_the_original_recorded_at() -> None:
    created = _expense(id=7)

    edited = _expense(
        category_id=2, amount=2_000, detail="otra cosa", recorded_at=created.recorded_at, id=7
    )

    assert edited.id == 7
    assert edited.recorded_at == created.recorded_at
    assert edited.category_id == 2
