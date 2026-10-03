"""`period_summary` (CODING_STANDARDS.md section 5: domain unit test, no infrastructure).
No `Sale` here is persisted; each is built straight from the dataclasses so the seam
under test stays `app.sales.domain.period_summary.period_summary` alone."""

from datetime import UTC, date, datetime

from app.sales.domain.period_summary import PeriodSalesSummary, period_summary
from app.sales.domain.pricing import PricingRule
from app.sales.domain.sale import Sale, SaleLine
from app.shared.grams import Grams

RECORDED_AT = datetime(2026, 6, 15, 12, 0, tzinfo=UTC)


def _line(
    *, grams: str, rule: PricingRule = PricingRule.LIST, price_per_gram: int = 1_000
) -> SaleLine:
    quantity = Grams.of(grams)
    total = 0 if rule is PricingRule.GIFT else (price_per_gram * quantity.hundredths) // 100
    return SaleLine(
        variety_id=1,
        grams=quantity,
        pricing_rule=rule,
        price_per_gram=0 if rule is PricingRule.GIFT else price_per_gram,
        line_total=total,
    )


def _sale(*, lines: tuple[SaleLine, ...], shipping_charged: int = 0) -> Sale:
    return Sale(
        date=date(2026, 6, 15),
        customer_id=None,
        shipping_charged=shipping_charged,
        note=None,
        lines=lines,
        payment=None,
        recorded_at=RECORDED_AT,
    )


def test_an_empty_list_of_sales_summarises_to_all_zeros() -> None:
    assert period_summary([]) == PeriodSalesSummary(
        total=0, count=0, grams_sold=Grams(0), grams_gifted=Grams(0)
    )


def test_shipping_charged_is_counted_in_the_total() -> None:
    sale = _sale(lines=(_line(grams="10"),), shipping_charged=500)

    summary = period_summary([sale])

    assert summary.total == sale.total == 10_500


def test_a_sale_totalling_zero_is_still_counted() -> None:
    sale = _sale(lines=(_line(grams="5", rule=PricingRule.GIFT),), shipping_charged=0)

    summary = period_summary([sale])

    assert summary.total == 0
    assert summary.count == 1


def test_gift_lines_and_non_gift_lines_split_between_grams_sold_and_grams_gifted() -> None:
    sale = _sale(
        lines=(
            _line(grams="10"),
            _line(grams="3", rule=PricingRule.GIFT),
        )
    )

    summary = period_summary([sale])

    assert summary.grams_sold == Grams.of("10")
    assert summary.grams_gifted == Grams.of("3")


def test_repeated_varieties_across_several_lines_and_sales_sum_their_grams() -> None:
    first = _sale(lines=(_line(grams="4"), _line(grams="6")))
    second = _sale(lines=(_line(grams="2"),))

    summary = period_summary([first, second])

    assert summary.count == 2
    assert summary.grams_sold == Grams.of("12")
    assert summary.grams_gifted == Grams(0)
