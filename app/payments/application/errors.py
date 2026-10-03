"""Use-case errors that are not already settlement rules (CODING_STANDARDS section 9):
a fixed message, no data. `settle`'s own domain (`app/payments/domain/payment.py`)
carries the rules that need the ledger or `today` — the future date, the amount, above
the balance, the missing method; these three are the ones only a use case can tell,
once a row has (or has not) been read back.
"""

from typing import ClassVar


class CustomerNotFound(LookupError):
    code: ClassVar[str] = "payment.customer_not_found"

    def __init__(self) -> None:
        super().__init__("no such customer")


class PaymentNotFound(LookupError):
    code: ClassVar[str] = "payment.not_found"

    def __init__(self) -> None:
        super().__init__("no such payment")


class OnTheSpot(ValueError):
    """An on-the-spot payment is deleted with its sale (sales.md, ADR-0007), never on
    its own route (the plan's invariant)."""

    code: ClassVar[str] = "payment.on_the_spot"

    def __init__(self) -> None:
        super().__init__("an on-the-spot payment is deleted with its sale")
