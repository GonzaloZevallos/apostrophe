"""`trailing_window`: the one place the 30-day window behind Days left and Most sold is
worked out (`DAYS_LEFT_WINDOW`, both ends included)."""

from datetime import date, timedelta

from app.shared.calendar import DAYS_LEFT_WINDOW, trailing_window


def test_a_normal_date_opens_the_window_29_days_back() -> None:
    on = date(2026, 11, 19)

    assert trailing_window(on) == (on - timedelta(days=29), on)
    assert DAYS_LEFT_WINDOW == 30


def test_the_first_representable_date_gives_a_one_day_window() -> None:
    assert trailing_window(date.min) == (date.min, date.min)


def test_a_date_closer_to_the_minimum_than_the_window_is_clamped() -> None:
    on = date.min + timedelta(days=10)

    assert trailing_window(on) == (date.min, on)


def test_the_first_date_that_needs_no_clamp_opens_exactly_29_days_back() -> None:
    on = date.min + timedelta(days=29)

    assert trailing_window(on) == (date.min, on)
    assert trailing_window(on + timedelta(days=1)) == (
        date.min + timedelta(days=1),
        on + timedelta(days=1),
    )
