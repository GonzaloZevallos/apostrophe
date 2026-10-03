"""A later payment's own rules, and `settle_candidate`, the one function a preview
and a record both call (CONTEXT.md: Payment; ADR-0012). Above-the-balance, the
future date and a non-positive amount are refused here, in the domain, before any
statement reaches the database — the guarded `INSERT … SELECT` is a second,
database-side refusal of the same rule, not the first one.
"""

from __future__ import annotations

from datetime import date, datetime

import pytest

from app.payments.domain.payment import (
    NewPayment,
    PaymentAboveBalance,
    PaymentAmountInvalid,
    PaymentCandidate,
    PaymentFutureDate,
    PaymentMethodRequired,
    settle_candidate,
)
from app.payments.domain.settlement import (
    LaterPaymentEntry,
    Ledger,
    OwedSale,
    PaymentMethod,
    settle,
)

TODAY = date(2026, 10, 2)
AT = datetime(2026, 9, 1, 10, 0)


def _ledger_owing(total: int) -> Ledger:
    return Ledger((OwedSale(1, date(2026, 9, 1), AT, total),), ())


def test_a_candidate_with_a_non_positive_amount_is_refused() -> None:
    with pytest.raises(PaymentAmountInvalid):
        PaymentCandidate(paid_on=TODAY, amount=0)


def test_a_new_payment_with_no_method_is_refused() -> None:
    with pytest.raises(PaymentMethodRequired):
        NewPayment(paid_on=TODAY, amount=50, method=None)


def test_a_new_payment_with_a_method_is_fine() -> None:
    payment = NewPayment(paid_on=TODAY, amount=50, method=PaymentMethod.CASH)

    assert payment.candidate == PaymentCandidate(paid_on=TODAY, amount=50)


def test_settle_candidate_refuses_a_future_date() -> None:
    with pytest.raises(PaymentFutureDate):
        settle_candidate(
            _ledger_owing(100), PaymentCandidate(paid_on=date(2026, 10, 3), amount=50), TODAY
        )


def test_settle_candidate_refuses_above_the_balance() -> None:
    # Proven negative: the domain guard must reject an amount above the balance,
    # not only accept one within it.
    with pytest.raises(PaymentAboveBalance):
        settle_candidate(_ledger_owing(100), PaymentCandidate(paid_on=TODAY, amount=101), TODAY)


def test_settle_candidate_refuses_any_amount_against_a_credit_or_settled_balance() -> None:
    settled = Ledger((), ())
    with pytest.raises(PaymentAboveBalance):
        settle_candidate(settled, PaymentCandidate(paid_on=TODAY, amount=1), TODAY)

    credit = Ledger(
        (OwedSale(1, date(2026, 9, 1), AT, 100),),
        (LaterPaymentEntry(1, date(2026, 9, 2), AT, 130, PaymentMethod.CASH),),
    )
    with pytest.raises(PaymentAboveBalance):
        settle_candidate(credit, PaymentCandidate(paid_on=TODAY, amount=1), TODAY)


def test_settle_candidate_accepts_an_amount_exactly_at_the_balance() -> None:
    candidate = PaymentCandidate(paid_on=TODAY, amount=100)
    result = settle_candidate(_ledger_owing(100), candidate, TODAY)

    assert result.balance == 0
    assert result.standing == "settled"
    assert result.owing_since is None
    [split] = result.applied_to
    assert (split.sale_id, split.amount) == (1, 100)


def test_settle_candidate_answers_exactly_what_recording_it_would_settle() -> None:
    """Preview = stored (PRD metric): applying the same candidate as a real later
    payment and calling `settle()` again lands on the same splits and balance."""
    ledger = Ledger(
        (
            OwedSale(1, date(2026, 9, 1), AT, 60),
            OwedSale(2, date(2026, 9, 10), AT, 60),
        ),
        (),
    )
    candidate = PaymentCandidate(paid_on=date(2026, 9, 20), amount=90)

    previewed = settle_candidate(ledger, candidate, TODAY)

    recorded = LaterPaymentEntry(
        id=999,
        paid_on=candidate.paid_on,
        recorded_at=datetime(2026, 9, 20, 12, 0),
        amount=candidate.amount,
        method=PaymentMethod.CASH,
    )
    after_recording = settle(Ledger(ledger.sales, (*ledger.payments, recorded)))
    [stored_settlement] = [p for p in after_recording.payments if p.payment_id == 999]

    assert previewed.applied_to == stored_settlement.splits
    assert previewed.balance == after_recording.balance
    assert previewed.owing_since == after_recording.owing_since
    assert previewed.standing == after_recording.standing
