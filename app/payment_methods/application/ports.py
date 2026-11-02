from datetime import datetime
from enum import StrEnum
from typing import Protocol

from app.payment_methods.domain.method import (
    PaymentMethod,
    PaymentMethodIcon,
    PaymentMethodName,
    PaymentMethodSeed,
)
from app.shared.language import Language


class Direction(StrEnum):
    UP = "up"
    DOWN = "down"


class PaymentMethods(Protocol):
    """The payment methods of one business: the business is fixed when the store is
    built, so nothing here can reach another business's methods (docs/adr/0004). Writes
    never commit; a method of another business is, from here, a method that does not
    exist (`PaymentMethodNotFound`).

    `archive`, `delete` and `move` are each one guarded statement, so the last-active
    and in-use rules hold under concurrency; a refusal is told apart afterwards by the
    domain rule that was broken."""

    def list_active(self) -> list[PaymentMethod]: ...

    def list_archived(self) -> list[PaymentMethod]: ...

    def get(self, method_id: int) -> PaymentMethod | None: ...

    def add(self, name: PaymentMethodName, icon: PaymentMethodIcon) -> PaymentMethod:
        """Puts the method last in the seller's order. Raises `PaymentMethodNameTaken`."""
        ...

    def rename(self, method_id: int, name: PaymentMethodName) -> PaymentMethod: ...

    def set_icon(self, method_id: int, icon: PaymentMethodIcon) -> PaymentMethod: ...

    def move(self, method_id: int, direction: Direction) -> None:
        """Swaps the method with its nearest active neighbour; at an edge, nothing."""
        ...

    def archive(self, method_id: int, at: datetime) -> None:
        """`at` is the instant the method left the list, from the injected clock."""
        ...

    def restore(self, method_id: int) -> None: ...

    def delete(self, method_id: int) -> None: ...

    def is_used(self, method_id: int) -> bool:
        """Whether some payment, an on-the-spot one included, points at the method right
        now. Never a stored fact."""
        ...


class PaymentMethodDefaults(Protocol):
    def for_language(self, language: Language) -> tuple[PaymentMethodSeed, ...]:
        """The methods a business opened in `language` starts with, in order, English for
        a language the copy has no catalog for."""
        ...
