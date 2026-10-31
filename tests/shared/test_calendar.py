"""`Month` and `Week` with no infrastructure (CODING_STANDARDS §5): the one place a
week or month boundary is computed (ADR-0020)."""

from datetime import UTC, date, datetime
from zoneinfo import ZoneInfo

import pytest

from app.shared.calendar import Month, Week, business_day, load_zone


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


def test_business_day_is_the_date_the_wall_clock_of_the_zone_shows() -> None:
    # 02:30 UTC on 3 Oct is still 2 Oct in Buenos Aires (UTC-3) and already 3 Oct in
    # Madrid (UTC+2): one instant, three different days.
    instant = datetime(2026, 10, 3, 2, 30, tzinfo=UTC)

    assert business_day(instant, ZoneInfo("America/Argentina/Buenos_Aires")) == date(2026, 10, 2)
    assert business_day(instant, ZoneInfo("Europe/Madrid")) == date(2026, 10, 3)
    assert business_day(instant, ZoneInfo("UTC")) == date(2026, 10, 3)


def test_business_day_follows_the_zone_across_a_day_edge_in_the_east() -> None:
    zone = ZoneInfo("Pacific/Auckland")

    assert business_day(datetime(2026, 10, 2, 10, 59, tzinfo=UTC), zone) == date(2026, 10, 2)
    assert business_day(datetime(2026, 10, 2, 11, 0, tzinfo=UTC), zone) == date(2026, 10, 3)


def test_load_zone_loads_a_known_name() -> None:
    zone = load_zone("America/Argentina/Buenos_Aires")

    assert zone is not None
    assert zone.key == "America/Argentina/Buenos_Aires"


@pytest.mark.parametrize(
    "name",
    [
        "Mars/Olympus_Mons",
        "",
        "america/argentina/buenos_aires",
        "../etc/passwd",
        "America/Argentina/Buenos_Aires ",
    ],
)
def test_load_zone_answers_none_for_a_name_that_is_not_an_iana_zone(name: str) -> None:
    assert load_zone(name) is None
