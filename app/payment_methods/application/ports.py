from collections.abc import Sequence
from datetime import datetime
from typing import Protocol

from app.payment_methods.domain.method import PaymentMethod, PaymentMethodIcon, PaymentMethodName
from app.shared.language import Language


class PaymentMethods(Protocol):
    """The payment methods of one business: the business is fixed when the store is
    built, so nothing here can reach another business's methods (docs/adr/0004). Writes
    flush and never commit."""

    def offered(self) -> list[PaymentMethod]:
        """Offered methods, by position then id."""
        ...

    def archived(self) -> list[PaymentMethod]: ...

    def by_id(self, method_id: int) -> PaymentMethod | None: ...

    def by_key(self, key: str) -> PaymentMethod | None:
        """The method, offered or archived, whose name has this `name_key`."""
        ...

    def add(self, name: PaymentMethodName, icon: PaymentMethodIcon) -> PaymentMethod:
        """Adds the method after every other one."""
        ...

    def save_details(self, method: PaymentMethod) -> PaymentMethod: ...

    def swap_positions(self, first: PaymentMethod, second: PaymentMethod) -> None: ...

    def archive(self, method_id: int, at: datetime) -> bool:
        """False, with nothing written, when it would leave no offered method."""
        ...

    def restore(self, method_id: int) -> None: ...

    def delete(self, method_id: int) -> bool:
        """False, with nothing written, when it would leave no offered method."""
        ...


class PaymentMethodUsage(Protocol):
    """Which methods have payments. `app/main.py` wires the adapter; the payments
    adapter replaces the stub that answers nothing is in use (docs/adr/0085)."""

    def in_use_among(self, method_ids: Sequence[int]) -> frozenset[int]: ...


class MethodDefaults(Protocol):
    def for_language(self, language: Language) -> tuple[PaymentMethodName, ...]:
        """The two methods a business opened in `language` starts with, in order,
        English for a language the copy has no catalog for."""
        ...
