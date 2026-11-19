"""`today_series` with no infrastructure (CODING_STANDARDS §5): which hour a Sale counts
at, the so-far window, the hourly running total and the change percent. Instants are
explicit and aware; the zone is a fixed UTC-3 offset, like Argentina's."""

from __future__ import annotations

from datetime import UTC, date, datetime, time, timedelta, timezone, tzinfo

import pytest

from app.results.domain.ledger import SaleRecord
from app.results.domain.today_series import (
    change_percent,
    hour_of,
    hourly_running_total,
    recorded_on_own_date,
    so_far,
)
from tests.results.factories import sale_record

ART = timezone(timedelta(hours=-3))
TODAY = date(2026, 11, 19)
LAST_WEEK = TODAY - timedelta(days=7)


def local(day: date, hour: int, minute: int = 0, second: int = 0, micro: int = 0) -> datetime:
    """An instant given by its ART wall time, as the aware UTC the record holds."""
    return datetime(day.year, day.month, day.day, hour, minute, second, micro, ART).astimezone(UTC)


def sale(sale_id: int, day: date, total: int, recorded_at: datetime) -> SaleRecord:
    return sale_record(sale_id, day, total=total, recorded_at=recorded_at)


def test_a_sale_recorded_on_its_date_counts_at_its_local_hour() -> None:
    assert hour_of(local(TODAY, 14, 55), TODAY, ART) == 14


def test_a_sale_recorded_just_after_local_midnight_counts_at_hour_zero() -> None:
    assert hour_of(local(TODAY, 0, 0, 0), TODAY, ART) == 0


def test_a_sale_recorded_just_before_local_midnight_counts_at_hour_23() -> None:
    assert hour_of(local(TODAY, 23, 59, 59), TODAY, ART) == 23


def test_the_local_date_not_the_utc_one_decides_the_hour() -> None:
    # 22:30 ART is 01:30 UTC the next day: still its own date locally.
    assert hour_of(local(TODAY, 22, 30), TODAY, ART) == 22


def test_a_sale_recorded_late_counts_at_the_end_of_its_date() -> None:
    assert hour_of(local(TODAY + timedelta(days=2), 9), TODAY, ART) == 23


def test_a_sale_dated_today_but_recorded_the_previous_day_counts_at_hour_23() -> None:
    assert hour_of(local(TODAY - timedelta(days=1), 9), TODAY, ART) == 23


def test_recorded_on_own_date_tells_on_time_from_late_and_early() -> None:
    on_time = sale(1, TODAY, 100, local(TODAY, 9))
    late = sale(2, TODAY, 100, local(TODAY + timedelta(days=1), 9))
    early = sale(3, TODAY, 100, local(TODAY - timedelta(days=1), 9))

    assert [recorded_on_own_date(s, ART) for s in (on_time, late, early)] == [True, False, False]


def test_a_late_sale_is_in_no_so_far_window() -> None:
    late = sale(1, TODAY, 500, local(TODAY + timedelta(days=1), 9))

    assert so_far([late], TODAY, time(23, 59, 59), ART) == 0


def test_a_sale_recorded_the_day_before_its_date_is_in_no_so_far_window() -> None:
    early = sale(1, TODAY, 500, local(TODAY - timedelta(days=1), 9))

    assert so_far([early], TODAY, time(23, 59, 59), ART) == 0


def test_a_sale_at_14_55_is_out_of_so_far_at_14_05_but_in_the_hour_14_point() -> None:
    afternoon = sale(1, LAST_WEEK, 700, local(LAST_WEEK, 14, 55))

    assert so_far([afternoon], LAST_WEEK, time(14, 5), ART) == 0
    assert hourly_running_total([afternoon], LAST_WEEK, ART, through_hour=23)[14] == 700


@pytest.mark.parametrize(
    ("second", "micro", "counted"),
    [(0, 0, True), (0, 999_999, True), (1, 0, False)],
)
def test_the_cut_is_to_the_whole_second(second: int, micro: int, counted: bool) -> None:
    recorded = sale(1, TODAY, 300, local(TODAY, 14, 5, second, micro))

    assert so_far([recorded], TODAY, time(14, 5, 0), ART) == (300 if counted else 0)


def test_a_sale_milliseconds_after_the_cut_within_the_same_second_is_included() -> None:
    # now 14:05:00.200 cuts at 14:05:00; a Sale at 14:05:00.700 is truncated to 14:05:00.
    recorded = sale(1, LAST_WEEK, 300, local(LAST_WEEK, 14, 5, 0, 700_000))

    assert so_far([recorded], LAST_WEEK, time(14, 5, 0), ART) == 300


def test_so_far_counts_only_the_asked_day() -> None:
    mine = sale(1, TODAY, 100, local(TODAY, 9))
    other = sale(2, LAST_WEEK, 900, local(LAST_WEEK, 9))

    assert so_far([mine, other], TODAY, time(12, 0), ART) == 100


def test_so_far_includes_shipping_through_the_total() -> None:
    shipped = sale_record(1, TODAY, total=1_500, shipping=500, recorded_at=local(TODAY, 9))

    assert so_far([shipped], TODAY, time(12, 0), ART) == 1_500


def test_the_hourly_total_is_cumulative_and_never_falls_back() -> None:
    sales = [
        sale(1, TODAY, 100, local(TODAY, 0, 0, 0)),
        sale(2, TODAY, 200, local(TODAY, 9, 30)),
        sale(3, TODAY, 50, local(TODAY, 9, 59, 59)),
        sale(4, TODAY, 1_000, local(TODAY, 14, 5)),
    ]

    series = hourly_running_total(sales, TODAY, ART, through_hour=14)

    assert len(series) == 15
    assert series[0] == 100
    assert series[8] == 100
    assert series[9] == 350
    assert series[13] == 350
    assert series[14] == 1_350
    assert list(series) == sorted(series)


def test_the_hourly_total_of_a_day_with_no_sales_is_zeros_through_the_hour() -> None:
    assert hourly_running_total([], TODAY, ART, through_hour=2) == (0, 0, 0)


def test_the_hourly_total_ignores_other_days() -> None:
    other = sale(1, LAST_WEEK, 900, local(LAST_WEEK, 9))

    assert hourly_running_total([other], TODAY, ART, through_hour=23) == (0,) * 24


def test_late_and_early_sales_sit_at_hour_23_and_outside_a_series_that_ends_at_14() -> None:
    late = sale(1, TODAY, 400, local(TODAY + timedelta(days=1), 9))
    early = sale(2, TODAY, 600, local(TODAY - timedelta(days=1), 9))

    assert hourly_running_total([late, early], TODAY, ART, through_hour=14) == (0,) * 15
    full = hourly_running_total([late, early], TODAY, ART, through_hour=23)
    assert full[22] == 0
    assert full[23] == 1_000


def test_the_hourly_total_at_the_current_hour_is_never_below_so_far() -> None:
    day_sales = [
        sale(1, TODAY, 100, local(TODAY, 0, 0, 0)),
        sale(2, TODAY, 250, local(TODAY, 9, 30, 15)),
        sale(3, TODAY, 70, local(TODAY, 14, 4, 59)),
        sale(4, TODAY, 90, local(TODAY, 14, 55)),
        sale(5, TODAY, 40, local(TODAY + timedelta(days=1), 3)),
        sale(6, TODAY, 60, local(TODAY - timedelta(days=1), 22)),
    ]
    cuts = [time(0, 0, 0), time(9, 30, 14), time(9, 30, 15), time(14, 5), time(23, 59, 59)]

    for cut in cuts:
        series = hourly_running_total(day_sales, TODAY, ART, through_hour=23)
        assert so_far(day_sales, TODAY, cut, ART) <= series[cut.hour]


@pytest.mark.parametrize(("today", "base"), [(0, 0), (500, 0)])
def test_the_change_percent_is_none_at_a_base_of_zero(today: int, base: int) -> None:
    assert change_percent(today, base) is None


def test_nothing_today_against_a_positive_base_is_minus_100() -> None:
    assert change_percent(0, 4_000) == -100


@pytest.mark.parametrize(
    ("today", "base", "expected"),
    [(1_125, 1_000, 13), (1_000, 1_000, 0), (875, 1_000, -12), (1_100, 1_000, 10)],
)
def test_the_change_percent_is_whole_signed_and_half_up(
    today: int, base: int, expected: int
) -> None:
    assert change_percent(today, base) == expected


def test_a_tiny_base_is_not_capped() -> None:
    assert change_percent(1_000_000, 1) == 99_999_900


class CountingZone(tzinfo):
    """A fixed UTC-3 zone that counts every conversion into it."""

    def __init__(self) -> None:
        self.conversions = 0

    def utcoffset(self, dt: datetime | None) -> timedelta:
        return timedelta(hours=-3)

    def dst(self, dt: datetime | None) -> timedelta:
        return timedelta(0)

    def tzname(self, dt: datetime | None) -> str:
        return "ART"

    def fromutc(self, dt: datetime) -> datetime:
        self.conversions += 1
        return dt + timedelta(hours=-3)


def test_only_sales_dated_today_or_a_week_ago_are_converted_to_local_time() -> None:
    zone = CountingZone()
    other_days = [
        day
        for day in (date(2026, 1, 1) + timedelta(days=n) for n in range(365))
        if day not in (TODAY, LAST_WEEK)
    ]
    noon = datetime(2026, 6, 1, 12, tzinfo=UTC)
    sales = [sale(i, other_days[i % len(other_days)], 100, noon) for i in range(1_000)]
    # 5 Sales across the two days of interest.
    for n, day in enumerate([TODAY, TODAY, TODAY, LAST_WEEK, LAST_WEEK]):
        sales.append(sale(2_000 + n, day, 100, local(day, 10)))
    cut = time(12, 0)

    so_far(sales, TODAY, cut, zone)
    so_far(sales, LAST_WEEK, cut, zone)
    hourly_running_total(sales, TODAY, zone, through_hour=12)
    hourly_running_total(sales, LAST_WEEK, zone, through_hour=23)

    assert zone.conversions <= 15


def test_a_sale_record_refuses_a_naive_recorded_at() -> None:
    with pytest.raises(ValueError, match="aware UTC instant"):
        SaleRecord(1, TODAY, 0, 100, recorded_at=datetime(2026, 11, 19, 12, 0))


def test_a_sale_record_refuses_a_non_utc_offset() -> None:
    with pytest.raises(ValueError, match="aware UTC instant"):
        SaleRecord(1, TODAY, 0, 100, recorded_at=datetime(2026, 11, 19, 12, 0, tzinfo=ART))
