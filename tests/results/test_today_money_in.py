"""Today's money in by Payment method and the last 7 days of Sales, with no
infrastructure: `money_in` and `last_7_days` read an already-`scan`ned `Buckets`, the same
one `totals_between` reads (GH-497 part 2)."""

from datetime import UTC, date, datetime, timedelta

import pytest

from app.results.domain.ledger import PaymentMethodRecord, PaymentRecord, SaleRecord
from app.results.domain.period_figures import Buckets, scan, totals_between
from app.results.domain.today_series import (
    DaySales,
    MethodMoney,
    MoneyIn,
    PaymentMethodMissing,
    last_7_days,
    money_in,
)

TODAY = date(2026, 10, 4)

CASH = PaymentMethodRecord(payment_method_id=1, name="Cash", position=0)
TRANSFER = PaymentMethodRecord(payment_method_id=2, name="Transfer", position=1)
ARCHIVED_WALLET = PaymentMethodRecord(payment_method_id=3, name="Old wallet", position=2)
METHODS = [CASH, TRANSFER, ARCHIVED_WALLET]


def _payment(day: date, amount: int, method: int) -> PaymentRecord:
    return PaymentRecord(day=day, amount=amount, payment_method_id=method)


def _buckets(
    payments: list[PaymentRecord] | None = None, sales: list[SaleRecord] | None = None
) -> Buckets:
    buckets, _ = scan(
        draws=[],
        sales=sales or [],
        payments=payments or [],
        expenses=[],
        purchases=[],
        earliest_entry_day=None,
    )
    return buckets


def _sale(sale_id: int, day: date, total: int, *, shipping: int = 0, recorded: date) -> SaleRecord:
    return SaleRecord(
        sale_id,
        day,
        shipping,
        total,
        recorded_at=datetime(recorded.year, recorded.month, recorded.day, 15, 0, tzinfo=UTC),
    )


def test_money_in_lists_methods_by_position_and_sums_the_total() -> None:
    buckets = _buckets(
        [_payment(TODAY, 300, 2), _payment(TODAY, 100, 1), _payment(TODAY, 50, 2)]
    )

    assert money_in(buckets, METHODS, TODAY) == MoneyIn(
        total=450,
        methods=(MethodMoney(1, "Cash", 100), MethodMoney(2, "Transfer", 350)),
    )


def test_money_in_breaks_a_position_tie_by_method_id() -> None:
    low = PaymentMethodRecord(payment_method_id=5, name="Low id", position=0)
    high = PaymentMethodRecord(payment_method_id=9, name="High id", position=0)
    buckets = _buckets([_payment(TODAY, 10, 9), _payment(TODAY, 20, 5)])

    result = money_in(buckets, [high, low], TODAY)

    assert [m.payment_method_id for m in result.methods] == [5, 9]


def test_money_in_keeps_an_archived_method_with_payments_today() -> None:
    buckets = _buckets([_payment(TODAY, 70, ARCHIVED_WALLET.payment_method_id)])

    assert money_in(buckets, METHODS, TODAY) == MoneyIn(
        total=70, methods=(MethodMoney(3, "Old wallet", 70),)
    )


def test_money_in_with_no_payments_today_is_zero_and_empty() -> None:
    assert money_in(_buckets(), METHODS, TODAY) == MoneyIn(0, ())


def test_money_in_leaves_out_a_payment_dated_another_day() -> None:
    buckets = _buckets(
        [
            _payment(TODAY - timedelta(days=1), 500, 1),
            _payment(TODAY + timedelta(days=1), 600, 1),
            _payment(TODAY, 40, 2),
        ]
    )

    assert money_in(buckets, METHODS, TODAY) == MoneyIn(40, (MethodMoney(2, "Transfer", 40),))


def test_money_in_omits_a_method_with_no_payments_today() -> None:
    buckets = _buckets([_payment(TODAY, 40, 1), _payment(TODAY - timedelta(days=2), 90, 2)])

    names = [m.name for m in money_in(buckets, METHODS, TODAY).methods]

    assert names == ["Cash"]


def test_money_in_total_is_the_cash_payments_received_for_today() -> None:
    buckets = _buckets([_payment(TODAY, 300, 2), _payment(TODAY, 100, 1), _payment(TODAY, 1, 3)])

    received = buckets.payments(TODAY, TODAY)
    assert money_in(buckets, METHODS, TODAY).total == received == 401
    assert totals_between(buckets, TODAY, TODAY).cash == received


def test_money_in_raises_a_named_error_for_an_unknown_method_without_leaking_data() -> None:
    buckets = _buckets([_payment(TODAY, 123_456, 77)])

    with pytest.raises(PaymentMethodMissing) as raised:
        money_in(buckets, METHODS, TODAY)

    assert str(raised.value) == "a payment's method is not among the business's payment methods"
    assert "77" not in str(raised.value)
    assert "123456" not in str(raised.value)


def test_last_7_days_is_seven_days_oldest_first_with_today_last() -> None:
    result = last_7_days(_buckets(), TODAY)

    assert [item.day for item in result] == [TODAY - timedelta(days=n) for n in range(6, -1, -1)]
    assert all(item.sales == 0 for item in result)


def test_last_7_days_crosses_a_month_boundary_and_zero_fills_empty_days() -> None:
    today = date(2026, 11, 2)
    buckets = _buckets(sales=[_sale(1, date(2026, 10, 31), 800, recorded=date(2026, 10, 31))])

    result = last_7_days(buckets, today)

    assert result[0] == DaySales(date(2026, 10, 27), 0)
    assert result[4] == DaySales(date(2026, 10, 31), 800)
    assert result[5] == DaySales(date(2026, 11, 1), 0)
    assert result[6] == DaySales(today, 0)


def test_each_day_of_last_7_days_is_the_total_between_reads_for_that_day() -> None:
    sales = [
        _sale(1, TODAY, 1_000, recorded=TODAY),
        _sale(2, TODAY - timedelta(days=1), 500, shipping=500, recorded=TODAY - timedelta(days=1)),
        _sale(3, TODAY - timedelta(days=2), 700, recorded=TODAY),
        _sale(4, TODAY - timedelta(days=6), 250, recorded=TODAY - timedelta(days=7)),
        _sale(5, TODAY - timedelta(days=7), 999, recorded=TODAY - timedelta(days=7)),
    ]
    buckets = _buckets(sales=sales)

    result = last_7_days(buckets, TODAY)

    assert len(result) == 7
    for item in result:
        assert item.sales == totals_between(buckets, item.day, item.day).sales
    assert [item.sales for item in result] == [250, 0, 0, 0, 700, 500, 1_000]
