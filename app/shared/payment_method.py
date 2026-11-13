"""How a payment names its method, for every capability that writes or reads one
(CONTEXT.md: Payment method; docs/adr/20261111-payment-methods-by-id).

A write carries a `PaymentMethodId`; a read carries a `PaymentMethodLabel`. Nothing
outside the payment methods hexagon decides what a method is: it is only ever an id the
writer's guarded insert checks, and a label shown as the method's current name.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import ClassVar


@dataclass(frozen=True)
class PaymentMethodId:
    """The method a write names. Whether it is usable is decided in the writer's own
    guarded statement, never here."""

    value: int

    def __post_init__(self) -> None:
        if self.value < 1:
            raise PaymentMethodUnavailable()


@dataclass(frozen=True)
class PaymentMethodLabel:
    """A method as a read shows it: its id, its current name and its icon key."""

    id: int
    name: str
    icon: str


class PaymentMethodUnavailable(LookupError):
    """The one answer for every method a write cannot use: unknown, of another business,
    archived or deleted. The message names no method."""

    code: ClassVar[str] = "payment_method.unavailable"

    def __init__(self) -> None:
        super().__init__("the payment method is not available")
