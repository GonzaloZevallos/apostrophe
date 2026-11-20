"""Debt age: per Sale still owing over Settlement, bucketed by the Sale's own date
(docs/adr/20261119-*). `today` is always a parameter; the domain reads no clock.
"""

from __future__ import annotations

from datetime import date, timedelta

import pytest

from app.payments.domain.debt_age import (
    DebtAgeBuckets,
    bucket_of,
    buckets,
)
from app.payments.domain.settlement import (
    LaterPaymentEntry,
    Ledger,
    SaleSettlement,
    settle,
)
from app.shared.payment_method import PaymentMethodLabel
from tests.payments.builders import AT, owed_sale

TODAY = date(2026, 10, 31)
_CASH = PaymentMethodLabel(1, "Cash", "banknote")


def _owing(still_owed: int, days_old: int, sale_id: int = 1) -> SaleSettlement:
    return SaleSettlement(sale_id, TODAY - timedelta(days=days_old), sale_id, still_owed)


@pytest.mark.parametrize(
    ("days", "bucket"),
    [
        (0, "this_week"),
        (7, "this_week"),
        (8, "days_8_30"),
        (30, "days_8_30"),
        (31, "over_30"),
        (400, "over_30"),
    ],
)
def test_the_bucket_edges(days: int, bucket: str) -> None:
    assert bucket_of(days) == bucket


def test_a_negative_age_is_rejected() -> None:
    with pytest.raises(ValueError, match="age in days cannot be negative: -1"):
        bucket_of(-1)


@pytest.mark.parametrize("field", ["this_week", "days_8_30", "over_30"])
def test_a_negative_bucket_is_rejected(field: str) -> None:
    with pytest.raises(ValueError, match=f"{field} cannot be negative: -5"):
        DebtAgeBuckets(**{"this_week": 0, "days_8_30": 0, "over_30": 0, field: -5})


def test_the_total_adds_the_three_buckets() -> None:
    assert DebtAgeBuckets(1, 20, 300).total == 321


def test_each_sale_goes_to_the_bucket_of_its_own_date() -> None:
    sales = [
        _owing(10, 7, 1),
        _owing(20, 8, 2),
        _owing(30, 30, 3),
        _owing(40, 31, 4),
    ]

    assert buckets(sales, TODAY) == DebtAgeBuckets(this_week=10, days_8_30=50, over_30=40)


def test_a_future_dated_sale_counts_in_this_week() -> None:
    assert buckets([_owing(10, -5)], TODAY) == DebtAgeBuckets(10, 0, 0)


def test_a_partly_paid_sale_counts_only_its_remainder() -> None:
    sale = owed_sale(1, TODAY - timedelta(days=40), 100)
    payment = LaterPaymentEntry(1, TODAY, AT, 30)

    result = settle(Ledger((sale,), (payment,)))

    assert buckets(result.sales, TODAY) == DebtAgeBuckets(0, 0, 70)


def test_a_customer_with_a_credit_adds_nothing() -> None:
    sale = owed_sale(1, TODAY - timedelta(days=40), 100)
    payment = LaterPaymentEntry(1, TODAY, AT, 150)

    result = settle(Ledger((sale,), (payment,)))

    assert result.balance == -50
    assert buckets(result.sales, TODAY) == DebtAgeBuckets(0, 0, 0)


def test_a_zero_total_owed_sale_adds_nothing() -> None:
    assert buckets([_owing(0, 3)], TODAY) == DebtAgeBuckets(0, 0, 0)


def test_the_remainders_and_the_buckets_add_up_to_the_balance() -> None:
    ledger = Ledger(
        (
            owed_sale(1, TODAY - timedelta(days=50), 100, on_the_spot_method=None),
            owed_sale(2, TODAY - timedelta(days=45), 100, on_the_spot_method=_CASH),
            owed_sale(3, TODAY - timedelta(days=20), 80),
            owed_sale(4, TODAY + timedelta(days=2), 60),
        ),
        (LaterPaymentEntry(1, TODAY - timedelta(days=10), AT, 130),),
    )

    result = settle(ledger)

    assert sum(sale.still_owed for sale in result.sales) == result.balance == 110
    assert buckets(result.sales, TODAY) == DebtAgeBuckets(this_week=60, days_8_30=50, over_30=0)
    assert buckets(result.sales, TODAY).total == result.balance
