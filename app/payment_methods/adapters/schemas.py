"""The HTTP shapes of a payment method. Bare: no pydantic length constraint, so every
rule stays the domain's and its message is a fixed string (ADR-0005)."""

from typing import Literal

from pydantic import BaseModel

from app.payment_methods.domain.method import DEFAULT_ICON, PaymentMethod, PaymentMethodIcon


class MethodIn(BaseModel):
    name: str
    icon: PaymentMethodIcon = DEFAULT_ICON


class MethodPatch(BaseModel):
    name: str | None = None
    icon: PaymentMethodIcon | None = None


class MoveIn(BaseModel):
    direction: Literal["up", "down"]


class MethodOut(BaseModel):
    id: int
    name: str
    icon: PaymentMethodIcon
    position: int
    in_use: bool

    @classmethod
    def of(cls, method: PaymentMethod, in_use: bool) -> "MethodOut":
        return cls(
            id=method.id,
            name=method.name.value,
            icon=method.icon,
            position=method.position,
            in_use=in_use,
        )
