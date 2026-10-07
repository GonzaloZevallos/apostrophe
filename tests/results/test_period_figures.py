"""`period_figures` with no infrastructure (CODING_STANDARDS §5, ADR-0020): the
margin matrix, best-and-ties, profit's pending N, sparse/empty history and the
variety-identity (docs/product/analysis.md's metrics)."""

import time
from datetime import date, timedelta

import pytest

from app.results.domain.figures import AnalysisFigures
from app.results.domain.ledger import (
    DrawRow,
    ExpenseRecord,
    PaymentRecord,
    PurchaseRecord,
    SaleRecord,
)
from app.results.domain.period_figures import period_figures, scan, totals_between
from app.shared.calendar import Month
from app.shared.grams import Grams

TODAY = date(2026, 10, 4)  # a Sunday
MONTH = Month.containing(TODAY)


def _figures(
    *,
    today: date = TODAY,
    month: Month = MONTH,
    draws: list[DrawRow] | None = None,
    sales: list[SaleRecord] | None = None,
    payments: list[PaymentRecord] | None = None,
    expenses: list[ExpenseRecord] | None = None,
    purchases: list[PurchaseRecord] | None = None,
    earliest_entry_day: date | None = None,
) -> AnalysisFigures:
    return period_figures(
        today=today,
        month=month,
        draws=draws or [],
        sales=sales or [],
        payments=payments or [],
        expenses=expenses or [],
        purchases=purchases or [],
        earliest_entry_day=earliest_entry_day,
    )


def _sold(
    *,
    day: date,
    variety_id: int,
    name: str,
    sale_id: int,
    line_total: int,
    grams: str,
    costed: int | None,
    pending: str,
) -> DrawRow:
    return DrawRow(
        kind="sold",
        day=day,
        variety_id=variety_id,
        variety_name=name,
        sale_id=sale_id,
        line_total=line_total,
        grams=Grams.of(grams),
        costed=costed,
        pending=Grams.of(pending),
    )


def _gifted(
    *,
    day: date,
    variety_id: int,
    name: str,
    sale_id: int,
    grams: str,
    costed: int | None,
    pending: str,
) -> DrawRow:
    return DrawRow(
        kind="gifted",
        day=day,
        variety_id=variety_id,
        variety_name=name,
        sale_id=sale_id,
        line_total=0,
        grams=Grams.of(grams),
        costed=costed,
        pending=Grams.of(pending),
    )


def _shortfall(*, day: date, costed: int | None, pending: str) -> DrawRow:
    return DrawRow(
        kind="shortfall",
        day=day,
        variety_id=None,
        variety_name=None,
        sale_id=None,
        line_total=None,
        grams=Grams.of("2"),
        costed=costed,
        pending=Grams.of(pending),
    )


# --- DrawRow is an enforcement artefact: its own __post_init__ must reject a draw
# that mixes a shortfall's shape with a sale line's fields. ---


def test_a_shortfall_draw_with_a_variety_is_rejected() -> None:
    with pytest.raises(ValueError, match="no variety or sale"):
        DrawRow(
            kind="shortfall",
            day=TODAY,
            variety_id=1,
            variety_name=None,
            sale_id=None,
            line_total=None,
            grams=Grams.of("2"),
            costed=1000,
            pending=Grams.of("0"),
        )


def test_a_sale_line_draw_with_no_variety_is_rejected() -> None:
    with pytest.raises(ValueError, match="its variety, sale and line total"):
        DrawRow(
            kind="sold",
            day=TODAY,
            variety_id=None,
            variety_name="V",
            sale_id=1,
            line_total=1000,
            grams=Grams.of("2"),
            costed=1000,
            pending=Grams.of("0"),
        )


# --- Margin matrix (docs/product/analysis.md: Margin matrix) ---


def test_a_variety_only_gifted_has_a_negative_margin_and_no_percentage() -> None:
    draws = [
        _gifted(
            day=TODAY,
            variety_id=1,
            name="Flor Gift",
            sale_id=1,
            grams="5",
            costed=2000,
            pending="0",
        )
    ]
    figures = _figures(draws=draws, sales=[SaleRecord(1, TODAY, 0, 0)], earliest_entry_day=TODAY)

    [row] = figures.month.varieties
    assert row.sales_without_shipping == 0
    assert row.margin.amount == -2000
    assert row.margin.percent is None
    assert row.share_percent is None  # the month's sales without shipping are $0


def test_a_mix_of_sold_and_gifted_sums_within_the_variety() -> None:
    draws = [
        _sold(
            day=TODAY, variety_id=1, name="Flor", sale_id=1, line_total=10_000, grams="10",
            costed=3_000, pending="0",
        ),
        _gifted(
            day=TODAY, variety_id=1, name="Flor", sale_id=2, grams="2", costed=600, pending="0"
        ),
    ]
    sales = [SaleRecord(1, TODAY, 0, 10_000), SaleRecord(2, TODAY, 0, 0)]
    figures = _figures(draws=draws, sales=sales, earliest_entry_day=TODAY)

    [row] = figures.month.varieties
    assert row.grams_sold == Grams.of("10")
    assert row.grams_gifted == Grams.of("2")
    assert row.cost.costed == 3_600
    assert row.margin.amount == 10_000 - 3_600


def test_pending_grams_are_marked_sorted_by_the_shown_figure() -> None:
    # 10 g sold for $10.000, 6 g costed $3.000, 4 g pending: $3.000 "y 4 g", 50%.
    pending_line = _sold(
        day=TODAY, variety_id=1, name="Pending", sale_id=1, line_total=10_000, grams="10",
        costed=3_000, pending="4",
    )
    clean_line = _sold(
        day=TODAY, variety_id=2, name="Clean", sale_id=2, line_total=5_000, grams="5",
        costed=1_000, pending="0",
    )
    sales = [SaleRecord(1, TODAY, 0, 10_000), SaleRecord(2, TODAY, 0, 5_000)]
    figures = _figures(draws=[pending_line, clean_line], sales=sales, earliest_entry_day=TODAY)

    pending_row = next(v for v in figures.month.varieties if v.name == "Pending")
    assert pending_row.margin.amount == 3_000
    assert pending_row.margin.percent == 50
    assert pending_row.margin.pending_grams == Grams.of("4")

    # Clean's margin ($4.000) beats Pending's ($3.000): sorted by the shown figure.
    assert [v.name for v in figures.month.varieties] == ["Clean", "Pending"]


def test_a_negative_adjustment_is_kept_out_of_the_variety_table_and_counted_as_shortfall() -> None:
    sold = _sold(
        day=TODAY, variety_id=1, name="Flor", sale_id=1, line_total=10_000, grams="10",
        costed=3_000, pending="0",
    )
    shortfall = _shortfall(day=TODAY, costed=1_000, pending="0")
    figures = _figures(
        draws=[sold, shortfall], sales=[SaleRecord(1, TODAY, 0, 10_000)], earliest_entry_day=TODAY
    )

    assert len(figures.month.varieties) == 1
    assert figures.month.shortfall is not None
    assert figures.month.shortfall.amount == 1_000


def test_a_month_with_only_gifts_has_no_share_and_no_average_percentage() -> None:
    draws = [
        _gifted(
            day=TODAY, variety_id=1, name="Flor", sale_id=1, grams="5", costed=2_000, pending="0"
        )
    ]
    figures = _figures(draws=draws, sales=[SaleRecord(1, TODAY, 0, 0)], earliest_entry_day=TODAY)

    assert figures.month.average_margin.percent is None
    assert figures.month.varieties[0].share_percent is None


# --- Identity (docs/product/analysis.md: One computation) ---


def test_variety_sales_without_shipping_plus_shipping_equal_the_month_s_sales() -> None:
    draws = [
        _sold(
            day=TODAY, variety_id=1, name="A", sale_id=1, line_total=8_000, grams="8",
            costed=2_000, pending="0",
        ),
    ]
    sales = [SaleRecord(1, TODAY, 1_500, 9_500)]
    figures = _figures(draws=draws, sales=sales, earliest_entry_day=TODAY)

    total_variety_sales = sum(v.sales_without_shipping for v in figures.month.varieties)
    assert total_variety_sales + 1_500 == figures.month.sales


# --- Profit's pending N (docs/product/analysis.md: Honest cost) ---


def test_profit_s_pending_n_counts_sold_gifted_and_shortfall_grams_in_its_own_week() -> None:
    sold = _sold(
        day=TODAY, variety_id=1, name="Flor", sale_id=1, line_total=4_000, grams="4",
        costed=None, pending="4",
    )
    shortfall = _shortfall(day=TODAY, costed=None, pending="2")
    figures = _figures(
        draws=[sold, shortfall], sales=[SaleRecord(1, TODAY, 0, 4_000)], earliest_entry_day=TODAY
    )

    [week] = [w for w in figures.weeks if w.first_day <= TODAY <= w.last_day]
    assert week.profit.pending_grams == Grams.of("6")
    assert figures.month.shortfall is not None
    assert figures.month.shortfall.pending_grams == Grams.of("2")


# --- Best and ties (docs/product/analysis.md: Best week, Best weekday) ---


def test_best_week_is_by_sales_not_profit() -> None:
    week1_day = date(2026, 9, 21)  # Monday, two weeks before TODAY's week
    week2_day = date(2026, 9, 28)  # Monday, the week before TODAY's week
    sales = [
        SaleRecord(1, week1_day, 0, 5_000),
        SaleRecord(2, week2_day, 0, 9_000),
    ]
    figures = _figures(sales=sales, earliest_entry_day=week1_day)

    best = [w for w in figures.weeks if w.best]
    assert len(best) == 1
    assert best[0].sales == 9_000


def test_a_week_tie_goes_to_the_most_recent() -> None:
    week1_day = date(2026, 9, 21)
    week2_day = date(2026, 9, 28)
    sales = [SaleRecord(1, week1_day, 0, 5_000), SaleRecord(2, week2_day, 0, 5_000)]
    figures = _figures(sales=sales, earliest_entry_day=week1_day)

    best = [w for w in figures.weeks if w.best]
    assert len(best) == 1
    assert best[0].first_day == date(2026, 9, 28)


def test_all_zero_weeks_mark_none_best() -> None:
    figures = _figures(earliest_entry_day=date(2026, 8, 1))

    assert not any(w.best for w in figures.weeks)


def test_a_weekday_tie_goes_to_the_earlier_day() -> None:
    monday = date(2026, 9, 28)
    wednesday = date(2026, 9, 30)
    sales = [SaleRecord(1, monday, 0, 3_000), SaleRecord(2, wednesday, 0, 3_000)]
    figures = _figures(sales=sales, earliest_entry_day=monday)

    best = [w for w in figures.weekdays if w.best]
    assert len(best) == 1
    assert best[0].weekday == 1  # Monday


def test_all_zero_weekdays_mark_none_best() -> None:
    figures = _figures(earliest_entry_day=date(2026, 8, 1))

    assert not any(w.best for w in figures.weekdays)


# --- Sparse and empty history (docs/product/analysis.md: Sparse history) ---


def test_no_week_or_month_appears_before_the_first_record() -> None:
    first_record = date(2026, 9, 25)  # inside the current week/month
    figures = _figures(earliest_entry_day=first_record)

    assert all(w.last_day >= first_record for w in figures.weeks)
    assert all(m.last_day >= first_record for m in figures.months)


def test_a_week_with_no_activity_inside_the_history_shows_zero() -> None:
    first_record = date(2026, 8, 1)
    figures = _figures(earliest_entry_day=first_record)

    assert len(figures.weeks) > 0
    assert all(w.sales == 0 and w.expenses == 0 and w.cash == 0 for w in figures.weeks)


def test_a_business_with_no_records_answers_the_empty_shape() -> None:
    figures = _figures(earliest_entry_day=None)

    assert figures.first_record is None
    assert figures.weeks == ()
    assert figures.months == ()
    assert figures.since_first_record is None
    assert figures.month.varieties == ()
    assert all(w.sales == 0 for w in figures.weekdays)


# --- Time guard (docs/product/analysis.md: Speed) ---


# --- totals_between (ADR-0013 amendment GH-70: Inicio's panel reads this seam,
# never a second sum of its own) ---


def test_totals_between_splits_sold_and_gifted_grams_and_counts_sales() -> None:
    sold = _sold(
        day=TODAY, variety_id=1, name="Flor", sale_id=1, line_total=10_000, grams="10",
        costed=3_000, pending="0",
    )
    gifted = _gifted(
        day=TODAY, variety_id=2, name="Regalo", sale_id=2, grams="2", costed=600, pending="0"
    )
    sales = [SaleRecord(1, TODAY, 0, 10_000), SaleRecord(2, TODAY, 0, 0)]
    buckets, _ = scan(
        draws=[sold, gifted],
        sales=sales,
        payments=[],
        expenses=[],
        purchases=[],
        earliest_entry_day=TODAY,
    )

    totals = totals_between(buckets, TODAY, TODAY)

    assert totals.sales == 10_000
    assert totals.sales_count == 2
    assert totals.grams_sold == Grams.of("10")
    assert totals.grams_gifted == Grams.of("2")
    assert totals.cost_of_goods.costed == 3_600
    assert totals.shortfall is None
    assert totals.profit.amount == 10_000 - 3_600


def test_totals_between_excludes_a_day_outside_the_window() -> None:
    """The enforcement artefact: a sale dated the day before the window must not leak
    into it — proof the window edge, not just "every day scanned", is honoured."""
    outside = TODAY - timedelta(days=1)
    sale = SaleRecord(1, outside, 0, 5_000)
    buckets, _ = scan(
        draws=[], sales=[sale], payments=[], expenses=[], purchases=[],
        earliest_entry_day=outside,
    )

    totals = totals_between(buckets, TODAY, TODAY)

    assert totals.sales == 0
    assert totals.sales_count == 0


def test_totals_between_answers_shortfall_none_with_no_negative_adjustment() -> None:
    sold = _sold(
        day=TODAY, variety_id=1, name="Flor", sale_id=1, line_total=5_000, grams="5",
        costed=1_000, pending="0",
    )
    buckets, _ = scan(
        draws=[sold], sales=[SaleRecord(1, TODAY, 0, 5_000)], payments=[], expenses=[],
        purchases=[], earliest_entry_day=TODAY,
    )

    totals = totals_between(buckets, TODAY, TODAY)

    assert totals.shortfall is None


def test_totals_between_carries_the_shortfall_s_own_amount_and_pending_grams() -> None:
    shortfall = _shortfall(day=TODAY, costed=1_000, pending="2")
    buckets, _ = scan(
        draws=[shortfall], sales=[], payments=[], expenses=[], purchases=[],
        earliest_entry_day=TODAY,
    )

    totals = totals_between(buckets, TODAY, TODAY)

    assert totals.shortfall is not None
    assert totals.shortfall.amount == 1_000
    assert totals.shortfall.pending_grams == Grams.of("2")


def test_the_domain_time_guard_runs_a_year_of_history_in_under_a_second() -> None:
    draws: list[DrawRow] = []
    sales: list[SaleRecord] = []
    for i in range(300):
        day = TODAY - timedelta(days=i % 400)
        variety_id = i % 30
        draws.append(
            _sold(
                day=day,
                variety_id=variety_id,
                name=f"Variedad {variety_id}",
                sale_id=i,
                line_total=1_000,
                grams="1",
                costed=800,
                pending="0",
            )
        )
        sales.append(SaleRecord(sale_id=i, day=day, shipping=0, total=1_000))
    for i in range(100):
        day = TODAY - timedelta(days=i % 400)
        draws.append(_shortfall(day=day, costed=10, pending="0"))
    payments = [
        PaymentRecord(day=TODAY - timedelta(days=i % 400), amount=500) for i in range(100)
    ]
    expenses = [
        ExpenseRecord(
            day=TODAY - timedelta(days=i % 400),
            amount=50,
            category_id=i % 5,
            name=f"Categoria {i % 5}",
            name_key=f"categoria {i % 5}",
        )
        for i in range(100)
    ]
    purchases = [
        PurchaseRecord(day=TODAY - timedelta(days=i % 400), total_cost=1_000) for i in range(100)
    ]

    started = time.monotonic()
    figures = _figures(
        draws=draws,
        sales=sales,
        payments=payments,
        expenses=expenses,
        purchases=purchases,
        earliest_entry_day=TODAY - timedelta(days=399),
    )
    elapsed = time.monotonic() - started

    assert elapsed < 1.0, elapsed
    assert len(figures.month.varieties) > 0
    assert figures.since_first_record is not None
