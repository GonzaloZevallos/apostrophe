"""`period_figures` with no infrastructure (CODING_STANDARDS §5, ADR-0020): the
margin matrix, best-and-ties, profit's pending N, sparse/empty history and the
variety-identity (docs/product/analysis.md's metrics)."""

import dataclasses
import time
from datetime import date, timedelta
from typing import Literal

import pytest

from app.results.domain.figures import (
    AmountWithPending,
    AnalysisFigures,
    CostAmount,
    CostFigure,
)
from app.results.domain.ledger import (
    DrawRow,
    ExpenseRecord,
    PaymentRecord,
    PurchaseRecord,
    SaleRecord,
)
from app.results.domain.period_figures import Buckets, period_figures, scan, totals_between
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


def _withdrawal(
    *,
    kind: Literal["promotion", "own_use"],
    day: date,
    grams: str,
    costed: int | None,
    pending: str,
) -> DrawRow:
    return DrawRow(
        kind=kind,
        day=day,
        variety_id=None,
        variety_name=None,
        sale_id=None,
        line_total=None,
        grams=Grams.of(grams),
        costed=costed,
        pending=Grams.of(pending),
    )


def _scan(
    draws: list[DrawRow],
    sales: list[SaleRecord] | None = None,
    earliest_entry_day: date | None = None,
) -> tuple[Buckets, date | None]:
    return scan(
        draws=draws,
        sales=sales or [],
        payments=[],
        expenses=[],
        purchases=[],
        earliest_entry_day=earliest_entry_day,
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


def test_a_withdrawal_draw_with_a_sale_or_a_line_total_is_rejected() -> None:
    for sale_id, line_total in ((1, None), (None, 1_000)):
        with pytest.raises(ValueError, match="no variety or sale|no line total"):
            DrawRow(
                kind="promotion",
                day=TODAY,
                variety_id=None,
                variety_name=None,
                sale_id=sale_id,
                line_total=line_total,
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


# --- Stock withdrawals: Promoción and Consumo propio (ADR-0031) ---

YESTERDAY = TODAY - timedelta(days=1)


def test_a_promotion_and_an_own_use_each_lower_profit_by_their_costed_amount_on_their_date() -> (
    None
):
    sold = _sold(
        day=TODAY,
        variety_id=1,
        name="Flor",
        sale_id=1,
        line_total=10_000,
        grams="10",
        costed=3_000,
        pending="0",
    )
    promotion = _withdrawal(kind="promotion", day=YESTERDAY, grams="2", costed=600, pending="0")
    own_use = _withdrawal(kind="own_use", day=TODAY, grams="1", costed=300, pending="0")
    buckets, _ = _scan([sold, promotion, own_use], [SaleRecord(1, TODAY, 0, 10_000)], TODAY)

    on_yesterday = totals_between(buckets, YESTERDAY, YESTERDAY)
    on_today = totals_between(buckets, TODAY, TODAY)

    assert on_yesterday.profit.amount == -600
    assert on_yesterday.promotion == CostAmount(600, Grams.of("0"), Grams.of("2"))
    assert on_yesterday.own_use is None
    assert on_today.profit.amount == 10_000 - 3_000 - 300
    assert on_today.own_use == CostAmount(300, Grams.of("0"), Grams.of("1"))
    assert on_today.promotion is None


def test_a_withdrawal_leaves_cost_of_goods_shortfall_sales_and_grams_sold_untouched() -> None:
    sold = _sold(
        day=TODAY,
        variety_id=1,
        name="Flor",
        sale_id=1,
        line_total=10_000,
        grams="10",
        costed=3_000,
        pending="0",
    )
    sales = [SaleRecord(1, TODAY, 0, 10_000)]
    without, _ = _scan([sold], sales, TODAY)
    withdrawals = [
        _withdrawal(kind="promotion", day=TODAY, grams="2", costed=600, pending="1"),
        _withdrawal(kind="own_use", day=TODAY, grams="3", costed=None, pending="3"),
    ]
    with_them, _ = _scan([sold, *withdrawals], sales, TODAY)

    before = totals_between(without, TODAY, TODAY)
    after = totals_between(with_them, TODAY, TODAY)

    assert after.cost_of_goods == before.cost_of_goods
    assert after.shortfall is None
    assert after.sales == before.sales
    assert after.sales_count == before.sales_count
    assert after.grams_sold == before.grams_sold
    assert after.grams_gifted == before.grams_gifted
    assert with_them.variety_day_totals == without.variety_day_totals
    assert with_them.day_totals == without.day_totals
    assert with_them.sales_by_day == without.sales_by_day
    assert with_them.weekday_sales == without.weekday_sales
    assert with_them.weekday_counts == without.weekday_counts


def test_a_withdrawal_never_enters_the_month_s_variety_table_or_shortfall() -> None:
    sold = _sold(
        day=TODAY,
        variety_id=1,
        name="Flor",
        sale_id=1,
        line_total=10_000,
        grams="10",
        costed=3_000,
        pending="0",
    )
    promotion = _withdrawal(kind="promotion", day=TODAY, grams="2", costed=600, pending="0")
    figures = _figures(
        draws=[sold, promotion],
        sales=[SaleRecord(1, TODAY, 0, 10_000)],
        earliest_entry_day=TODAY,
    )

    [row] = figures.month.varieties
    assert row.grams_sold == Grams.of("10")
    assert row.margin.amount == 7_000
    assert figures.month.shortfall is None
    assert figures.month.average_margin.amount == 7_000


def test_a_pending_only_withdrawal_gives_profit_a_pending_count_and_cost_of_goods_none() -> None:
    promotion = _withdrawal(kind="promotion", day=TODAY, grams="4", costed=None, pending="4")
    buckets, _ = _scan([promotion], earliest_entry_day=TODAY)

    totals = totals_between(buckets, TODAY, TODAY)

    assert totals.profit == AmountWithPending(0, Grams.of("4"))
    assert totals.promotion == CostAmount(0, Grams.of("4"), Grams.of("0"))
    assert totals.cost_of_goods == CostFigure(0, Grams.of("0"), Grams.of("0"))


def test_each_reason_counts_only_its_own_pending_grams_and_profit_adds_every_one() -> None:
    sold = _sold(
        day=TODAY,
        variety_id=1,
        name="Flor",
        sale_id=1,
        line_total=1_000,
        grams="1",
        costed=None,
        pending="1",
    )
    promotion = _withdrawal(kind="promotion", day=TODAY, grams="4", costed=None, pending="4")
    own_use = _withdrawal(kind="own_use", day=TODAY, grams="2", costed=None, pending="2")
    buckets, _ = _scan([sold, promotion, own_use], [SaleRecord(1, TODAY, 0, 1_000)], TODAY)

    totals = totals_between(buckets, TODAY, TODAY)

    assert totals.promotion is not None
    assert totals.promotion.pending_grams == Grams.of("4")
    assert totals.own_use is not None
    assert totals.own_use.pending_grams == Grams.of("2")
    assert totals.profit.pending_grams == Grams.of("7")


def test_a_withdrawal_dated_before_every_other_record_moves_the_first_record() -> None:
    earlier = TODAY - timedelta(days=20)
    sold = _sold(
        day=TODAY,
        variety_id=1,
        name="Flor",
        sale_id=1,
        line_total=1_000,
        grams="1",
        costed=100,
        pending="0",
    )
    withdrawal = _withdrawal(kind="own_use", day=earlier, grams="1", costed=100, pending="0")

    _, first_record = _scan([sold, withdrawal], [SaleRecord(1, TODAY, 0, 1_000)], TODAY)

    assert first_record == earlier


def test_a_window_with_no_withdrawal_of_a_reason_answers_none_for_it() -> None:
    promotion = _withdrawal(kind="promotion", day=YESTERDAY, grams="1", costed=100, pending="0")
    buckets, _ = _scan([promotion], earliest_entry_day=YESTERDAY)

    totals = totals_between(buckets, TODAY, TODAY)

    assert totals.promotion is None
    assert totals.own_use is None


def test_a_withdrawal_draw_with_only_a_variety_is_rejected() -> None:
    with pytest.raises(ValueError, match="no variety or sale"):
        DrawRow(
            kind="own_use",
            day=TODAY,
            variety_id=1,
            variety_name=None,
            sale_id=None,
            line_total=None,
            grams=Grams.of("2"),
            costed=1000,
            pending=Grams.of("0"),
        )


# --- Windows: the two withdrawal lines in the month, weeks, months and since-first-record ---


def test_the_month_header_shows_each_reason_only_when_present_with_its_own_pending_grams() -> None:
    promotion = _withdrawal(kind="promotion", day=TODAY, grams="2", costed=600, pending="1")
    figures = _figures(draws=[promotion], earliest_entry_day=TODAY)

    assert figures.month.promotion == CostAmount(600, Grams.of("1"), Grams.of("1"))
    assert figures.month.own_use is None


def test_a_week_and_a_month_row_carry_the_lines_and_profit_equals_totals_between() -> None:
    promotion = _withdrawal(kind="promotion", day=TODAY, grams="2", costed=600, pending="0")
    own_use = _withdrawal(kind="own_use", day=TODAY, grams="3", costed=None, pending="3")
    figures = _figures(draws=[promotion, own_use], earliest_entry_day=TODAY)
    buckets, _ = _scan([promotion, own_use], earliest_entry_day=TODAY)

    [week] = [w for w in figures.weeks if w.first_day <= TODAY <= w.last_day]
    [month_row] = [m for m in figures.months if m.month == MONTH]
    week_totals = totals_between(buckets, week.first_day, week.last_day)
    month_totals = totals_between(buckets, month_row.first_day, month_row.last_day)

    assert week.promotion == CostAmount(600, Grams.of("0"), Grams.of("2"))
    assert week.own_use == CostAmount(0, Grams.of("3"), Grams.of("0"))
    assert week.profit == week_totals.profit == AmountWithPending(-600, Grams.of("3"))
    assert month_row.promotion == week.promotion
    assert month_row.own_use == week.own_use
    assert month_row.profit == month_totals.profit


def test_since_the_first_record_carries_both_lines() -> None:
    earlier = TODAY - timedelta(days=40)
    promotion = _withdrawal(kind="promotion", day=earlier, grams="1", costed=100, pending="0")
    own_use = _withdrawal(kind="own_use", day=TODAY, grams="1", costed=300, pending="0")
    # The stock entry is dated after the withdrawal: only the withdrawal can start the
    # history at `earlier`.
    figures = _figures(draws=[promotion, own_use], earliest_entry_day=TODAY)

    assert figures.first_record == earlier
    assert figures.since_first_record is not None
    assert figures.since_first_record.promotion == CostAmount(100, Grams.of("0"), Grams.of("1"))
    assert figures.since_first_record.own_use == CostAmount(300, Grams.of("0"), Grams.of("1"))
    assert figures.since_first_record.profit == AmountWithPending(-400, Grams.of("0"))


def test_a_withdrawal_as_the_only_record_starts_the_history_with_zero_sales() -> None:
    promotion = _withdrawal(kind="promotion", day=YESTERDAY, grams="2", costed=600, pending="0")
    figures = _figures(draws=[promotion])

    assert figures.first_record == YESTERDAY
    assert figures.since_first_record is not None
    assert figures.since_first_record.sales == 0
    assert figures.since_first_record.profit == AmountWithPending(-600, Grams.of("0"))
    assert figures.weeks[0].first_day <= YESTERDAY <= figures.weeks[0].last_day
    assert figures.months[0].month == Month.containing(YESTERDAY)
    assert figures.weeks[-1].profit == AmountWithPending(-600, Grams.of("0"))


def test_a_withdrawal_moves_no_variety_row_share_average_margin_best_week_or_weekday() -> None:
    sold = _sold(
        day=TODAY, variety_id=1, name="Flor", sale_id=1, line_total=1_000, grams="1",
        costed=400, pending="0",
    )
    promotion = _withdrawal(kind="promotion", day=TODAY, grams="5", costed=900, pending="0")
    sales = [SaleRecord(1, TODAY, 0, 1_000)]
    alone = _figures(draws=[sold], sales=sales, earliest_entry_day=TODAY)
    with_withdrawal = _figures(draws=[sold, promotion], sales=sales, earliest_entry_day=TODAY)

    assert with_withdrawal.month.varieties == alone.month.varieties
    assert with_withdrawal.month.average_margin == alone.month.average_margin
    assert with_withdrawal.month.grams_sold == alone.month.grams_sold
    assert with_withdrawal.month.grams_gifted == alone.month.grams_gifted
    assert with_withdrawal.weekdays == alone.weekdays
    assert [w.best for w in with_withdrawal.weeks] == [w.best for w in alone.weeks]
    assert [w.grams for w in with_withdrawal.weeks] == [w.grams for w in alone.weeks]


def test_a_week_with_7_g_sold_2_g_promoted_and_1_g_own_use_pending_reads_exactly_so() -> None:
    sold = _sold(
        day=TODAY, variety_id=1, name="Flor", sale_id=1, line_total=7_000, grams="7",
        costed=None, pending="7",
    )
    promotion = _withdrawal(kind="promotion", day=TODAY, grams="2", costed=None, pending="2")
    own_use = _withdrawal(kind="own_use", day=TODAY, grams="1", costed=None, pending="1")
    figures = _figures(
        draws=[sold, promotion, own_use],
        sales=[SaleRecord(1, TODAY, 0, 7_000)],
        earliest_entry_day=TODAY,
    )

    [week] = [w for w in figures.weeks if w.first_day <= TODAY <= w.last_day]
    assert week.promotion == CostAmount(0, Grams.of("2"), Grams.of("0"))
    assert week.own_use == CostAmount(0, Grams.of("1"), Grams.of("0"))
    assert week.profit.pending_grams == Grams.of("10")


# --- GH-141: each cost figure counts only its own pending grams ---


def test_a_pending_shortfall_and_a_pending_sale_line_each_count_only_their_own_grams() -> None:
    sold = _sold(
        day=TODAY, variety_id=1, name="Flor", sale_id=1, line_total=3_000, grams="3",
        costed=None, pending="3",
    )
    shortfall = _shortfall(day=TODAY, costed=None, pending="2")
    buckets, _ = _scan([sold, shortfall], [SaleRecord(1, TODAY, 0, 3_000)], TODAY)

    totals = totals_between(buckets, TODAY, TODAY)

    assert totals.shortfall is not None
    assert totals.cost_of_goods.pending_grams == Grams.of("3")
    assert totals.shortfall.pending_grams == Grams.of("2")


def test_all_pending_is_true_only_when_pending_grams_exist_and_none_were_costed() -> None:
    for figure in (
        CostAmount(0, Grams.of("2"), Grams.of("0")),
        CostFigure(0, Grams.of("2"), Grams.of("0")),
    ):
        assert figure.all_pending is True
    for figure in (
        CostAmount(500, Grams.of("1"), Grams.of("3")),
        CostFigure(500, Grams.of("1"), Grams.of("3")),
        CostAmount(500, Grams.of("0"), Grams.of("3")),
        CostFigure(500, Grams.of("0"), Grams.of("3")),
        CostAmount(0, Grams.of("0"), Grams.of("0")),
        CostFigure(0, Grams.of("0"), Grams.of("0")),
    ):
        assert figure.all_pending is False


def test_a_zero_cost_lot_with_pending_grams_beside_it_is_not_all_pending() -> None:
    free = _sold(
        day=TODAY, variety_id=1, name="Flor", sale_id=1, line_total=2_000, grams="2",
        costed=0, pending="0",
    )
    pending = _sold(
        day=TODAY, variety_id=1, name="Flor", sale_id=2, line_total=1_000, grams="1",
        costed=None, pending="1",
    )
    buckets, _ = _scan([free, pending], [SaleRecord(1, TODAY, 0, 3_000)], TODAY)

    cost = totals_between(buckets, TODAY, TODAY).cost_of_goods

    assert cost.costed == 0
    assert cost.pending_grams == Grams.of("1")
    assert cost.costed_grams == Grams.of("2")
    assert cost.all_pending is False


def test_a_variety_sold_at_cost_with_pending_grams_has_margin_zero_and_is_not_all_pending() -> None:
    sold = _sold(
        day=TODAY, variety_id=1, name="Flor", sale_id=1, line_total=2_000, grams="4",
        costed=1_000, pending="2",
    )
    figures = _figures(
        draws=[sold], sales=[SaleRecord(1, TODAY, 0, 2_000)], earliest_entry_day=TODAY
    )

    [row] = figures.month.varieties
    assert row.margin.amount == 0
    assert row.cost.pending_grams == Grams.of("2")
    assert row.cost.costed_grams == Grams.of("2")
    assert row.cost.all_pending is False


def test_a_variety_with_every_gram_pending_has_an_all_pending_cost() -> None:
    sold = _sold(
        day=TODAY, variety_id=1, name="Flor", sale_id=1, line_total=2_000, grams="4",
        costed=None, pending="4",
    )
    figures = _figures(
        draws=[sold], sales=[SaleRecord(1, TODAY, 0, 2_000)], earliest_entry_day=TODAY
    )

    [row] = figures.month.varieties
    assert row.cost.costed_grams == Grams.of("0")
    assert row.cost.all_pending is True


def test_costed_grams_of_a_withdrawal_line_is_its_draw_grams_minus_its_pending() -> None:
    promotion = _withdrawal(kind="promotion", day=TODAY, grams="5", costed=300, pending="2")
    buckets, _ = _scan([promotion], earliest_entry_day=TODAY)

    totals = totals_between(buckets, TODAY, TODAY)

    assert totals.promotion == CostAmount(300, Grams.of("2"), Grams.of("3"))


def test_every_week_and_month_row_copies_cost_of_goods_and_shortfall_from_totals_between() -> None:
    sold = _sold(
        day=TODAY, variety_id=1, name="Flor", sale_id=1, line_total=3_000, grams="3",
        costed=900, pending="1",
    )
    shortfall = _shortfall(day=YESTERDAY, costed=200, pending="1")
    old = TODAY - timedelta(days=45)
    old_sold = _sold(
        day=old, variety_id=1, name="Flor", sale_id=2, line_total=1_000, grams="1",
        costed=300, pending="0",
    )
    draws = [sold, shortfall, old_sold]
    sales = [SaleRecord(1, TODAY, 0, 3_000), SaleRecord(2, old, 0, 1_000)]
    figures = _figures(draws=draws, sales=sales, earliest_entry_day=old)
    buckets, _ = _scan(draws, sales, old)

    assert len(figures.weeks) > 1
    assert len(figures.months) > 1
    for week in figures.weeks:
        totals = totals_between(buckets, week.first_day, week.last_day)
        assert week.cost_of_goods == totals.cost_of_goods
        assert week.shortfall == totals.shortfall
    for row in figures.months:
        totals = totals_between(buckets, row.first_day, row.last_day)
        assert row.cost_of_goods == totals.cost_of_goods
        assert row.shortfall == totals.shortfall
    assert figures.weeks[-1].shortfall == CostAmount(200, Grams.of("1"), Grams.of("1"))
    assert figures.weeks[0].shortfall is None


def test_a_week_with_only_gifts_carries_their_cost_and_no_shortfall() -> None:
    gift = _gifted(
        day=TODAY, variety_id=1, name="Flor", sale_id=1, grams="2", costed=700, pending="0"
    )
    figures = _figures(draws=[gift], earliest_entry_day=TODAY)

    week = figures.weeks[-1]
    assert week.cost_of_goods.costed == 700
    assert week.shortfall is None
    assert week.promotion is None


def test_a_week_with_only_withdrawals_and_adjustments_has_zero_cost_of_goods() -> None:
    promotion = _withdrawal(kind="promotion", day=TODAY, grams="2", costed=600, pending="0")
    own_use = _withdrawal(kind="own_use", day=TODAY, grams="1", costed=300, pending="0")
    withdrawals_only = _figures(draws=[promotion, own_use], earliest_entry_day=TODAY)
    shortfall = _shortfall(day=TODAY, costed=250, pending="0")
    adjustment_only = _figures(draws=[shortfall], earliest_entry_day=TODAY)

    week = withdrawals_only.weeks[-1]
    assert week.cost_of_goods == CostFigure(0, Grams.of("0"), Grams.of("0"))
    assert week.promotion == CostAmount(600, Grams.of("0"), Grams.of("2"))
    assert week.own_use == CostAmount(300, Grams.of("0"), Grams.of("1"))
    assert week.shortfall is None
    adjusted = adjustment_only.weeks[-1]
    assert adjusted.cost_of_goods == CostFigure(0, Grams.of("0"), Grams.of("0"))
    assert adjusted.shortfall == CostAmount(250, Grams.of("0"), Grams.of("2"))


def test_the_month_header_shortfall_equals_that_months_row_for_none_costed_and_all_pending() -> (
    None
):
    for draws in (
        [],
        [_shortfall(day=TODAY, costed=250, pending="0")],
        [_shortfall(day=TODAY, costed=None, pending="2")],
    ):
        figures = _figures(draws=draws, earliest_entry_day=TODAY)
        [row] = [m for m in figures.months if m.month == MONTH]
        assert figures.month.shortfall == row.shortfall
    assert figures.month.shortfall is not None
    assert figures.month.shortfall.all_pending is True


def test_no_domain_cost_type_gives_costed_grams_a_default() -> None:
    """`costed_grams` has no default in any domain type (ADR-0020 amendment GH-141), so a
    construction that forgets it cannot compile."""
    for cls in (CostAmount, CostFigure):
        [costed_grams] = [f for f in dataclasses.fields(cls) if f.name == "costed_grams"]
        assert costed_grams.default is dataclasses.MISSING
        assert costed_grams.default_factory is dataclasses.MISSING
