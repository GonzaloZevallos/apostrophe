"""Preview and record a later payment (CONTEXT.md: Registrar cobro; ADR-0012): both
call `settle_candidate`, so they can never answer differently.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime

from app.payments.application.errors import CustomerNotFound
from app.payments.application.ports import AvailableMethods, Ledgers, Payments
from app.payments.domain.payment import (
    PaymentAboveBalance,
    PaymentCandidate,
    PaymentMethodRequired,
)
from app.payments.domain.payment import settle_candidate as domain_settle_candidate
from app.payments.domain.settlement import Split, Standing
from app.shared.payment_method import PaymentMethodLabel, PaymentMethodUnavailable
from app.shared.transaction import Transaction


@dataclass(frozen=True)
class CandidateOutcome:
    """What a preview or a record answers about the candidate itself: the sales it
    reaches and the ledger's state once it is applied."""

    applied_to: tuple[Split, ...]
    balance: int
    owing_since: date | None
    standing: Standing


def settle_candidate(
    ledgers: Ledgers, customer_id: int, candidate: PaymentCandidate, today: date
) -> CandidateOutcome:
    """Loads the customer's ledger through `Ledgers`, then runs the domain's own
    `settle_candidate` (future date, then above the balance, in the domain, before any
    statement reaches the database): a preview and a record answer identically
    because both reach this, never a read followed by an unconditional insert."""
    ledger = ledgers.for_customer(customer_id)
    if ledger is None:
        raise CustomerNotFound()
    result = domain_settle_candidate(ledger, candidate, today)
    return CandidateOutcome(
        applied_to=result.applied_to,
        balance=result.balance,
        owing_since=result.owing_since,
        standing=result.standing,
    )


def preview_payment(
    ledgers: Ledgers, customer_id: int, paid_on: date, amount: int, today: date
) -> CandidateOutcome:
    return settle_candidate(ledgers, customer_id, PaymentCandidate(paid_on, amount), today)


@dataclass(frozen=True)
class RecordedPayment:
    id: int
    paid_on: date
    amount: int
    method: PaymentMethodLabel
    outcome: CandidateOutcome


def record_payment(
    ledgers: Ledgers,
    payments: Payments,
    methods: AvailableMethods,
    transaction: Transaction,
    customer_id: int,
    paid_on: date,
    amount: int,
    payment_method_id: int | None,
    today: date,
    recorded_at: datetime,
) -> RecordedPayment:
    """`settle_candidate`, then the method check, then `insert_later`, then one
    commit (the plan's own order): the future date and above-the-balance refusals
    must be answered before a missing method is, so a candidate that could never be
    recorded never gets to complain about its method instead."""
    outcome = settle_candidate(ledgers, customer_id, PaymentCandidate(paid_on, amount), today)
    if payment_method_id is None:
        raise PaymentMethodRequired()
    try:
        payment_id = payments.insert_later(
            customer_id, paid_on, amount, payment_method_id, recorded_at
        )
    except PaymentAboveBalance:
        # The guarded insert wrote no row for one of two reasons; a read in the same
        # transaction tells which, so an unavailable method never reads as a balance.
        if methods.available(payment_method_id) is None:
            raise PaymentMethodUnavailable() from None
        raise
    method = methods.available(payment_method_id)
    if method is None:
        transaction.rollback()
        raise PaymentMethodUnavailable()
    transaction.commit()
    return RecordedPayment(
        id=payment_id, paid_on=paid_on, amount=amount, method=method, outcome=outcome
    )
