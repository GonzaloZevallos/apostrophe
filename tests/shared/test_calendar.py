"""`Month` and `Week` with no infrastructure (CODING_STANDARDS §5): the one place a
week or month boundary is computed (ADR-0013)."""

from datetime import date

import pytest

from app.shared.calendar import Month, Week


def test_a_well_formed_month_is_parsed() -> None:
    assert Month.of("2026-10") == Month(2026, 10)


@pytest.mark.parametrize(
    "raw", ["2026-13", "2026-00", "2026-1", "26-10", "", "nope", "0000-01", "9999-12"]
)
def test_a_malformed_month_raises_a_plain_value_error(raw: str) -> None:
    with pytest.raises(ValueError, match="YYYY-MM"):
        Month.of(raw)


def test_month_containing_and_boundaries() -> None:
    month = Month.containing(date(2026, 10, 2))

    assert month == Month(2026, 10)
    assert month.first_day == date(2026, 10, 1)
    assert month.next_first_day == date(2026, 11, 1)
    assert month.last_day == date(2026, 10, 31)


def test_month_previous_and_next_cross_the_year_boundary() -> None:
    december = Month(2026, 12)
    january = Month(2027, 1)

    assert december.next == january
    assert january.previous == december


def test_week_containing_is_monday_to_sunday() -> None:
    week = Week.containing(date(2026, 10, 2))  # a Friday

    assert week.first_day == date(2026, 9, 28)
    assert week.last_day == date(2026, 10, 4)
    assert week.next_first_day == date(2026, 10, 5)


def test_week_previous_steps_back_seven_days() -> None:
    week = Week.containing(date(2026, 10, 2))

    assert week.previous == Week(date(2026, 9, 21))
