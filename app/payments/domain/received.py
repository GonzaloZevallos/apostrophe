"""Caja's own input (CONTEXT.md: Cash): every payment received in a period, counted
on its own `paid_on` date, on-the-spot and later alike (PRD: "What Caja counts"). This
is the one place their sum is taken for a period — never a SQL aggregate (plan
invariant: no SQL `SUM` or other aggregate over payments is added anywhere).

Plain `date` bounds, not `app.results`' `Period`: this module is payments' own domain,
and domain imports no other hexagon (plan invariant; CODING_STANDARDS section 1).
"""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass
from datetime import date


@dataclass(frozen=True)
class ReceivedPayment:
    """One payment's two facts a period sum needs, whatever it is attached to."""

    paid_on: date
    amount: int


def received_in(payments: Sequence[ReceivedPayment], start: date, end: date) -> int:
    """The sum of every payment dated inside `[start, end]`, inclusive on both ends."""
    return sum(payment.amount for payment in payments if start <= payment.paid_on <= end)
