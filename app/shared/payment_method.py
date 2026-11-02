"""How another capability sees a payment method (docs/adr/0055): an id plus what the
seller reads, never a figure and never a name to branch on. Payments and sales carry a
`PaymentMethodLabel`; only `app/payment_methods` knows what a method is."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class PaymentMethodLabel:
    id: int
    name: str
    icon: str

    def __post_init__(self) -> None:
        if self.id < 1:
            raise ValueError("a payment method label needs the id of a stored method")
        if not self.name:
            raise ValueError("a payment method label needs a name")
        if not self.icon:
            raise ValueError("a payment method label needs an icon")
