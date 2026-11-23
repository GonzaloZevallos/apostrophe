"""Today's oldest-debtors summary: pure ordering over a structural `Debts` answer."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta

import pytest

from app.payments.domain.debt_age import bucket_of
from app.results.domain.today_ordering import (
    OWED_ROWS,
    OwedRow,
    OwedSummary,
    age_level,
    owed_summary,
)

TODAY = date(2026, 11, 19)


@dataclass(frozen=True)
class _Debtor:
    customer_id: int
    name: str
    balance: int
    owing_since: date
    phone: str | None = None


@dataclass(frozen=True)
class _Debts:
    total_owed: int
    sales_owing_count: int
    debtors: tuple[_Debtor, ...]


def _since(days_old: int) -> date:
    return TODAY - timedelta(days=days_old)


def _debts(*debtors: _Debtor, total_owed: int = 0, sales_owing_count: int = 0) -> _Debts:
    return _Debts(total_owed, sales_owing_count, tuple(debtors))


def _ids(summary: OwedSummary) -> list[int]:
    return [row.customer_id for row in summary.debtors]


def test_the_oldest_owing_since_comes_first() -> None:
    debts = _debts(
        _Debtor(1, "Ana", 900, _since(2)),
        _Debtor(2, "Beto", 100, _since(20)),
        _Debtor(3, "Carla", 500, _since(10)),
    )

    assert _ids(owed_summary(debts, TODAY)) == [2, 3, 1]


def test_the_same_owing_since_puts_the_larger_balance_first() -> None:
    debts = _debts(
        _Debtor(1, "Ana", 100, _since(5)),
        _Debtor(2, "Beto", 300, _since(5)),
        _Debtor(3, "Carla", 200, _since(5)),
    )

    assert _ids(owed_summary(debts, TODAY)) == [2, 3, 1]


def test_the_same_balance_orders_by_the_name_ignoring_case_and_spaces() -> None:
    debts = _debts(
        _Debtor(1, "  luis   perez", 100, _since(5)),
        _Debtor(2, "Ana Gomez", 100, _since(5)),
        _Debtor(3, "BETO", 100, _since(5)),
    )

    assert _ids(owed_summary(debts, TODAY)) == [2, 3, 1]


def test_the_same_name_orders_by_the_lower_customer_id() -> None:
    debts = _debts(
        _Debtor(9, "Ana", 100, _since(5)),
        _Debtor(4, "ana", 100, _since(5)),
        _Debtor(7, " ANA ", 100, _since(5)),
    )

    assert _ids(owed_summary(debts, TODAY)) == [4, 7, 9]


@pytest.mark.parametrize(
    ("days", "level"),
    [
        (0, "none"),
        (7, "none"),
        (8, "warning"),
        (30, "warning"),
        (31, "overdue"),
    ],
)
def test_the_level_at_the_edges(days: int, level: str) -> None:
    assert age_level(days) == level

    row = owed_summary(_debts(_Debtor(1, "Ana", 100, _since(days))), TODAY).debtors[0]

    assert (row.age_days, row.age_level) == (days, level)


def test_an_owing_since_of_today_has_age_zero_and_no_level() -> None:
    row = owed_summary(_debts(_Debtor(1, "Ana", 100, TODAY)), TODAY).debtors[0]

    assert (row.age_days, row.age_level) == (0, "none")


def test_a_future_owing_since_has_age_zero_sorts_after_today_and_still_counts() -> None:
    future = _Debtor(1, "Ana", 100, TODAY + timedelta(days=3))
    today = _Debtor(2, "Beto", 100, TODAY)

    summary = owed_summary(_debts(future, today), TODAY)

    assert _ids(summary) == [2, 1]
    assert [(row.age_days, row.age_level) for row in summary.debtors] == [(0, "none")] * 2
    assert summary.debtor_count == 2


def test_only_the_first_rows_are_kept_while_every_debtor_is_counted() -> None:
    debts = _debts(*(_Debtor(i, f"D{i}", 100, _since(i)) for i in range(1, 6)))

    summary = owed_summary(debts, TODAY)

    assert OWED_ROWS == 3
    assert _ids(summary) == [5, 4, 3]
    assert summary.debtor_count == 5


def test_the_totals_come_back_exactly_as_passed_in() -> None:
    debts = _debts(_Debtor(1, "Ana", 100, _since(1)), total_owed=12345, sales_owing_count=77)

    summary = owed_summary(debts, TODAY)

    assert (summary.total_owed, summary.sales_owing_count) == (12345, 77)
    assert summary.debtor_count == 1


def test_no_debtors_gives_zeros_and_no_rows() -> None:
    assert owed_summary(_debts(), TODAY) == OwedSummary(0, 0, 0, ())


@pytest.mark.parametrize("phone", ["+54 11 5555 1234", None])
def test_the_phone_is_passed_through_untouched(phone: str | None) -> None:
    debts = _debts(_Debtor(1, "Ana", 100, _since(1), phone))

    assert owed_summary(debts, TODAY).debtors[0].phone == phone


def test_the_row_carries_the_debtor_figures() -> None:
    row = owed_summary(_debts(_Debtor(5, "Ana", 250, _since(9), "123")), TODAY).debtors[0]

    assert row == OwedRow(5, "Ana", 250, _since(9), 9, "warning", "123")


@pytest.mark.parametrize("days", range(41))
def test_the_level_agrees_with_the_payments_bucket(days: int) -> None:
    expected = {"this_week": "none", "days_8_30": "warning", "over_30": "overdue"}

    assert age_level(days) == expected[bucket_of(days)]


def test_a_row_rejects_a_negative_age() -> None:
    with pytest.raises(ValueError, match="age_days cannot be negative"):
        OwedRow(1, "Ana", 100, TODAY, -1, "none", None)


@pytest.mark.parametrize("balance", [0, -5])
def test_a_row_rejects_a_balance_that_is_not_positive(balance: int) -> None:
    with pytest.raises(ValueError, match="balance must be above zero"):
        OwedRow(1, "Ana", balance, TODAY, 0, "none", None)


@pytest.mark.parametrize("field", ["total_owed", "debtor_count", "sales_owing_count"])
def test_a_summary_rejects_a_negative_figure(field: str) -> None:
    figures = {"total_owed": 0, "debtor_count": 0, "sales_owing_count": 0, field: -1}

    with pytest.raises(ValueError, match=f"{field} cannot be negative"):
        OwedSummary(**figures, debtors=())


def test_a_summary_rejects_more_rows_than_the_cut() -> None:
    rows = tuple(OwedRow(i, "Ana", 100, TODAY, 0, "none", None) for i in range(OWED_ROWS + 1))

    with pytest.raises(ValueError, match="at most 3 rows"):
        OwedSummary(0, len(rows), 0, rows)
