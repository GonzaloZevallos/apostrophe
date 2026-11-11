"""A business's own list of payment methods (CONTEXT.md: Payment method).

The name follows the shared name rule (`app/shared/names.py`). "In use" is never stored:
`check_removable` is handed the fact, read at the moment of the call. A payment points
to its method by id, so renaming never rewrites history (docs/adr/20261111-payment-methods-by-id).
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from enum import StrEnum

from app.payment_methods.domain.errors import InUse, LastOffered, NameRequired, NameTooLong
from app.shared.names import NameProblem, collapse_spaces, name_key, name_problem

NAME_MAX_LENGTH = 60


class PaymentMethodIcon(StrEnum):
    """The closed, neutral set a method's icon is chosen from: nothing here is a
    country, a bank or a brand."""

    BANKNOTE = "banknote"
    COINS = "coins"
    CARD = "card"
    BANK = "bank"
    PHONE = "phone"
    WALLET = "wallet"
    QR = "qr"
    OTHER = "other"


DEFAULT_ICON = PaymentMethodIcon.OTHER


@dataclass(frozen=True)
class PaymentMethodName:
    """A method's name, with inner whitespace collapsed. Two names that differ only in
    case or spaces are the same name (`name_key`)."""

    value: str

    def __post_init__(self) -> None:
        problem = name_problem(self.value, NAME_MAX_LENGTH)
        if problem is NameProblem.EMPTY:
            raise NameRequired("a payment method needs a name")
        if problem is NameProblem.UNTRIMMED:
            raise NameRequired("a payment method name has no leading, trailing or repeated spaces")
        if problem is NameProblem.TOO_LONG:
            raise NameTooLong(f"a payment method name has at most {NAME_MAX_LENGTH} characters")

    @classmethod
    def of(cls, raw: str) -> PaymentMethodName:
        return cls(collapse_spaces(raw))

    @property
    def name_key(self) -> str:
        return name_key(self.value)


@dataclass
class PaymentMethod:
    id: int
    name: PaymentMethodName
    icon: PaymentMethodIcon
    position: int
    archived_at: datetime | None = None

    @property
    def offered(self) -> bool:
        return self.archived_at is None

    def check_archivable(self, offered_count: int) -> None:
        """Raises `LastOffered` when this is the only offered method."""
        if self.offered and offered_count <= 1:
            raise LastOffered()

    def check_removable(self, in_use: bool, offered_count: int) -> None:
        """Raises `LastOffered` for the only offered method, `InUse` for one that has
        payments (it can only be archived)."""
        self.check_archivable(offered_count)
        if in_use:
            raise InUse()
