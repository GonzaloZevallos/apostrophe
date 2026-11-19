"""`view_accounts.debtors()`: debt age, the three buckets, the counts and the order
(docs/adr/20261119-*), over a fake `Ledgers` so no storage is involved. Ages and
buckets come from `settle()` and `debt_age`; the use case only gathers them.
"""

from __future__ import annotations

from collections.abc import Collection, Mapping, Sequence
from datetime import date, timedelta

from app.payments.application.ports import NamedLedger
from app.payments.application.view_accounts import debtors
from app.payments.domain.settlement import LaterPaymentEntry, Ledger
from tests.payments.builders import AT, owed_sale

TODAY = date(2026, 10, 31)


class FakeLedgers:
    def __init__(self, named: Sequence[NamedLedger]) -> None:
        self._named = named

    def for_customer(self, customer_id: int) -> Ledger | None:
        return next((n.ledger for n in self._named if n.id == customer_id), None)

    def for_customers(self, customer_ids: Collection[int]) -> Mapping[int, Ledger]:
        return {n.id: n.ledger for n in self._named if n.id in customer_ids}

    def all(self) -> Sequence[NamedLedger]:
        return self._named


def _ago(days: int) -> date:
    return TODAY - timedelta(days=days)


def _owing(customer_id: int, name: str, *sales: tuple[int, int]) -> NamedLedger:
    """A customer with owed sales given as `(days_old, total)`."""
    return NamedLedger(
        id=customer_id,
        name=name,
        ledger=Ledger(
            sales=tuple(
                owed_sale(customer_id * 100 + index, _ago(days), total)
                for index, (days, total) in enumerate(sales)
            ),
            payments=(),
        ),
    )


def test_a_debtor_with_an_old_and_a_recent_sale_feeds_both_buckets_and_carries_the_older() -> None:
    ledgers = FakeLedgers([_owing(1, "Ana", (40, 700), (2, 300))])

    answer = debtors(ledgers, TODAY)

    assert answer.buckets.over_30 == 700
    assert answer.buckets.this_week == 300
    assert answer.buckets.days_8_30 == 0
    (only,) = answer.debtors
    assert only.age_days == 40
    assert only.bucket == "over_30"


def test_the_bucket_boundaries_are_7_8_30_and_31_days() -> None:
    ledgers = FakeLedgers(
        [
            _owing(1, "Seven", (7, 10)),
            _owing(2, "Eight", (8, 10)),
            _owing(3, "Thirty", (30, 10)),
            _owing(4, "Thirty one", (31, 10)),
        ]
    )

    answer = debtors(ledgers, TODAY)

    by_name = {row.name: (row.age_days, row.bucket) for row in answer.debtors}
    assert by_name == {
        "Seven": (7, "this_week"),
        "Eight": (8, "days_8_30"),
        "Thirty": (30, "days_8_30"),
        "Thirty one": (31, "over_30"),
    }
    assert (answer.buckets.this_week, answer.buckets.days_8_30, answer.buckets.over_30) == (
        10,
        20,
        10,
    )


def test_a_sale_dated_after_today_has_age_zero_and_is_this_week() -> None:
    ledgers = FakeLedgers([_owing(1, "Ana", (-3, 500))])

    answer = debtors(ledgers, TODAY)

    (only,) = answer.debtors
    assert (only.age_days, only.bucket) == (0, "this_week")
    assert answer.buckets.this_week == 500


def test_a_credit_customer_never_enters_the_buckets() -> None:
    credit = NamedLedger(
        id=2,
        name="Credit",
        ledger=Ledger(
            sales=(owed_sale(201, _ago(40), 100),),
            payments=(LaterPaymentEntry(1, _ago(1), AT, 500),),
        ),
    )
    ledgers = FakeLedgers([_owing(1, "Ana", (40, 700), (2, 300)), credit])

    answer = debtors(ledgers, TODAY)

    assert answer.total_owed == 1_000
    assert answer.buckets.total == answer.total_owed


def test_with_no_debtors_all_three_buckets_are_zero() -> None:
    answer = debtors(FakeLedgers([]), TODAY)

    assert (answer.buckets.this_week, answer.buckets.days_8_30, answer.buckets.over_30) == (0, 0, 0)
    assert (answer.customer_count, answer.debtor_count) == (0, 0)


def test_customer_count_includes_no_sales_and_credit_but_debtor_count_does_not() -> None:
    nothing = NamedLedger(id=3, name="Nothing", ledger=Ledger(sales=(), payments=()))
    credit = NamedLedger(
        id=2,
        name="Credit",
        ledger=Ledger(
            sales=(owed_sale(201, _ago(5), 100),),
            payments=(LaterPaymentEntry(1, _ago(1), AT, 500),),
        ),
    )
    ledgers = FakeLedgers([_owing(1, "Ana", (5, 100)), credit, nothing])

    answer = debtors(ledgers, TODAY)

    assert answer.customer_count == 3
    assert answer.debtor_count == 1


def test_a_larger_balance_comes_first_on_the_same_owing_since() -> None:
    ledgers = FakeLedgers([_owing(1, "Ana", (10, 100)), _owing(2, "Beto", (10, 900))])

    answer = debtors(ledgers, TODAY)

    assert [row.name for row in answer.debtors] == ["Beto", "Ana"]


def test_the_folded_name_breaks_a_tie_on_owing_since_and_balance() -> None:
    ledgers = FakeLedgers([_owing(1, "Émile", (10, 100)), _owing(2, "Ana", (10, 100))])

    answer = debtors(ledgers, TODAY)

    assert [row.name for row in answer.debtors] == ["Ana", "Émile"]


def test_the_same_folded_name_falls_to_recording_order() -> None:
    ledgers = FakeLedgers([_owing(7, "ANA", (10, 100)), _owing(3, "Ana", (10, 100))])

    answer = debtors(ledgers, TODAY)

    assert [row.customer_id for row in answer.debtors] == [3, 7]
