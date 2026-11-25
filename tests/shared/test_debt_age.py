"""The debt-age limits and `age_in_days`, defined once for every hexagon."""

from __future__ import annotations

from datetime import date, timedelta

import pytest

from app.shared.debt_age import RECENT_UP_TO_DAYS, WARNING_UP_TO_DAYS, age_in_days

TODAY = date(2026, 10, 31)


def test_age_is_the_days_between_the_sale_and_today() -> None:
    assert age_in_days(date(2026, 10, 24), TODAY) == 7


def test_a_future_date_has_age_zero() -> None:
    assert age_in_days(TODAY + timedelta(days=3), TODAY) == 0


def test_the_same_day_has_age_zero() -> None:
    assert age_in_days(TODAY, TODAY) == 0


@pytest.mark.parametrize("days", [7, 8, 30, 31])
def test_age_counts_whole_days_back(days: int) -> None:
    assert age_in_days(TODAY - timedelta(days=days), TODAY) == days


def test_the_limits_are_seven_and_thirty_days() -> None:
    assert RECENT_UP_TO_DAYS == 7
    assert WARNING_UP_TO_DAYS == 30
