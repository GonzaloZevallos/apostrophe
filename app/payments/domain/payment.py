"""A later payment's own rules, and `settle_candidate`, the one function a preview
and a record both call so they can never answer differently (ADR-0012; CONTEXT.md:
Payment).

Above-the-balance, the future date and a non-positive amount are refused here, in
the domain, before any statement reaches the database (the plan's invariant:
recording a later payment refuses above the balance in the domain first, then
through one guarded `INSERT … SELECT`, never a read followed by an unconditional
insert).
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime
from typing import ClassVar

from app.payments.domain.settlement import (
    LaterPaymentEntry,
    Ledger,
    PaymentMethod,
    Split,
    Standing,
    settle,
)


class PaymentAmountInvalid(ValueError):
    code: ClassVar[str] = "payment.amount_invalid"

    def __init__(self) -> None:
        super().__init__("a payment must be for a positive amount")


class PaymentFutureDate(ValueError):
    code: ClassVar[str] = "payment.future_date"

    def __init__(self) -> None:
        super().__init__("a payment cannot be dated in the future")


class PaymentMethodRequired(ValueError):
    code: ClassVar[str] = "payment.method_required"

    def __init__(self) -> None:
        super().__init__("a payment needs a method")


class PaymentAboveBalance(ValueError):
    code: ClassVar[str] = "payment.above_balance"

    def __init__(self) -> None:
        super().__init__("a payment cannot exceed the customer's balance")


@dataclass(frozen=True)
class PaymentCandidate:
    """What a preview or a record asks to apply: a date and an amount, no method
    (CONTEXT.md: Registrar cobro). Above-the-balance and the future date are
    `settle_candidate`'s own job, since both need the ledger or `today`; only the
    amount is checked here, at construction."""

    paid_on: date
    amount: int

    def __post_init__(self) -> None:
        if self.amount <= 0:
            raise PaymentAmountInvalid()


@dataclass(frozen=True)
class NewPayment:
    """A later payment about to be recorded: a candidate plus the method a record
    (never a preview) always carries."""

    paid_on: date
    amount: int
    method: PaymentMethod | None

    def __post_init__(self) -> None:
        if self.amount <= 0:
            raise PaymentAmountInvalid()
        if self.method is None:
            raise PaymentMethodRequired()

    @property
    def candidate(self) -> PaymentCandidate:
        return PaymentCandidate(self.paid_on, self.amount)


# Stands in for "+∞" (the plan's own words): with the real id this large, a candidate
# always sorts after every payment already on the ledger, whatever its `recorded_at`.
_CANDIDATE_ID = 2**62


@dataclass(frozen=True)
class CandidateSettlement:
    """What `settle_candidate` answers: the splits the candidate itself would reach,
    and the ledger's state once it is applied (CONTEXT.md: Registrar cobro)."""

    applied_to: tuple[Split, ...]
    balance: int
    owing_since: date | None
    standing: Standing


def settle_candidate(
    ledger: Ledger, candidate: PaymentCandidate, today: date
) -> CandidateSettlement:
    """Preview and record both call this: refuses a future date, then an amount
    above the current balance, then answers the candidate's own splits and the
    state after, by running `settle()` with the candidate placed last (`paid_on`,
    `+∞`)."""
    if candidate.paid_on > today:
        raise PaymentFutureDate()

    current = settle(ledger)
    if candidate.amount > current.balance:
        raise PaymentAboveBalance()

    candidate_entry = LaterPaymentEntry(
        id=_CANDIDATE_ID,
        paid_on=candidate.paid_on,
        recorded_at=datetime.max,
        amount=candidate.amount,
    )
    after = settle(Ledger(ledger.sales, (*ledger.payments, candidate_entry)))
    [candidate_settlement] = [p for p in after.payments if p.payment_id == _CANDIDATE_ID]

    return CandidateSettlement(
        applied_to=candidate_settlement.splits,
        balance=after.balance,
        owing_since=after.owing_since,
        standing=after.standing,
    )
