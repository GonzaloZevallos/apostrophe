"""`Month` with no infrastructure (CODING_STANDARDS §5): the only code that parses
`?month=` or computes a month's boundaries."""

from datetime import date

import pytest

from app.expenses.domain.month import InvalidMonth, Month


def test_a_well_formed_month_is_parsed() -> None:
    month = Month.of("2026-10")

    assert month == Month(2026, 10)


@pytest.mark.parametrize(
    "raw",
    ["2026-13", "2026-00", "2026-1", "26-10", "2026/10", "", "nope", "0000-01", "9999-12"],
)
def test_a_malformed_month_is_refused(raw: str) -> None:
    with pytest.raises(InvalidMonth, match="YYYY-MM"):
        Month.of(raw)


def test_containing_builds_the_month_a_day_falls_in() -> None:
    assert Month.containing(date(2026, 10, 2)) == Month(2026, 10)


def test_first_day_and_next_first_day_bound_the_month() -> None:
    month = Month(2026, 10)

    assert month.first_day == date(2026, 10, 1)
    assert month.next_first_day == date(2026, 11, 1)


def test_december_rolls_into_next_january() -> None:
    month = Month(2026, 12)

    assert month.next_first_day == date(2027, 1, 1)


def test_str_renders_as_year_dash_month() -> None:
    assert str(Month(2026, 1)) == "2026-01"
