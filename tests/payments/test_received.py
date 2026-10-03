"""`received_in` (CODING_STANDARDS section 5: domain unit test, no infrastructure):
the pure sum Caja's `PaymentsReceived` port takes per period, over payments already in
memory.
"""

from __future__ import annotations

from datetime import date

from app.payments.domain.received import ReceivedPayment, received_in


def test_received_in_sums_only_payments_inside_the_bounds() -> None:
    payments = [
        ReceivedPayment(paid_on=date(2026, 9, 30), amount=1_000),
        ReceivedPayment(paid_on=date(2026, 10, 1), amount=2_000),
        ReceivedPayment(paid_on=date(2026, 10, 3), amount=4_000),
        ReceivedPayment(paid_on=date(2026, 10, 4), amount=8_000),
    ]

    total = received_in(payments, date(2026, 10, 1), date(2026, 10, 3))

    assert total == 2_000 + 4_000


def test_received_in_includes_both_bounds() -> None:
    payments = [
        ReceivedPayment(paid_on=date(2026, 10, 1), amount=1_000),
        ReceivedPayment(paid_on=date(2026, 10, 31), amount=1_000),
    ]

    assert received_in(payments, date(2026, 10, 1), date(2026, 10, 31)) == 2_000


def test_received_in_is_zero_with_no_matching_payments() -> None:
    payments = [ReceivedPayment(paid_on=date(2026, 1, 1), amount=5_000)]

    assert received_in(payments, date(2026, 10, 1), date(2026, 10, 31)) == 0
