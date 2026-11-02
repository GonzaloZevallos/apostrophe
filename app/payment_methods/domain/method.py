"""Payment methods (CONTEXT.md: Payment method; docs/adr/0055).

A method belongs to one business: a name the seller chose, an icon from a small fixed
set and a position in the seller's order. It is a label, never a figure, and nothing
here (or anywhere) compares its name or branches on it. "In use" is never stored: the
rules are handed the answer the repository computes at the moment of the call.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum
from typing import ClassVar

from app.shared.names import NameProblem, collapse_spaces, name_problem
from app.shared.payment_method import PaymentMethodLabel

NAME_MAX_LENGTH = 40


class PaymentMethodRuleBroken(ValueError):
    """A rule of payment methods was broken; the message says which."""

    code: ClassVar[str] = "payment_method.rule_broken"


class PaymentMethodNameEmpty(PaymentMethodRuleBroken):
    code: ClassVar[str] = "payment_method.name_empty"

    def __init__(self) -> None:
        super().__init__("a payment method needs a name")


class PaymentMethodNameTooLong(PaymentMethodRuleBroken):
    code: ClassVar[str] = "payment_method.name_too_long"

    def __init__(self) -> None:
        super().__init__(f"a payment method name has at most {NAME_MAX_LENGTH} characters")


class PaymentMethodNameTaken(ValueError):
    """Archived methods still reserve their name."""

    code: ClassVar[str] = "payment_method.name_taken"

    def __init__(self) -> None:
        super().__init__("another payment method of the business already has that name")


class LastActivePaymentMethod(ValueError):
    code: ClassVar[str] = "payment_method.last_active"

    def __init__(self) -> None:
        super().__init__("the last active payment method can be neither archived nor deleted")


class PaymentMethodInUse(ValueError):
    code: ClassVar[str] = "payment_method.in_use"

    def __init__(self) -> None:
        super().__init__("a payment uses the method, so it can only be archived")


class PaymentMethodNotFound(LookupError):
    code: ClassVar[str] = "payment_method.not_found"

    def __init__(self, method_id: int) -> None:
        super().__init__(f"no payment method {method_id}")


class PaymentMethodIcon(StrEnum):
    WALLET = "wallet"
    BANK = "bank"
    CARD = "card"
    COINS = "coins"
    PHONE = "phone"
    GENERIC = "generic"

    DEFAULT = GENERIC


@dataclass(frozen=True)
class PaymentMethodName:
    """A method's name, trimmed with inner whitespace collapsed. Two names that differ
    only in case or spaces are the same name (`name_key`)."""

    value: str

    def __post_init__(self) -> None:
        problem = name_problem(self.value, NAME_MAX_LENGTH)
        if problem is NameProblem.EMPTY:
            raise PaymentMethodNameEmpty()
        if problem is NameProblem.UNTRIMMED:
            raise ValueError("a payment method name has no leading, trailing or repeated spaces")
        if problem is NameProblem.TOO_LONG:
            raise PaymentMethodNameTooLong()

    @classmethod
    def of(cls, raw: str) -> PaymentMethodName:
        return cls(collapse_spaces(raw))

    @property
    def name_key(self) -> str:
        return "".join(self.value.casefold().split())


@dataclass(frozen=True)
class PaymentMethod:
    name: PaymentMethodName
    icon: PaymentMethodIcon
    position: int
    archived: bool = False
    id: int | None = None

    def check_archivable(self, active_count: int) -> None:
        """Raises `LastActivePaymentMethod` when this is the only active method.
        Archiving an archived method changes nothing, so it is never refused."""
        if not self.archived and active_count <= 1:
            raise LastActivePaymentMethod()

    def check_deletable(self, active_count: int, used: bool) -> None:
        """A method some payment uses is only ever archived; the last active method is
        neither archived nor deleted. An archived method is not active, so the last
        active one is not at stake when it goes."""
        if used:
            raise PaymentMethodInUse()
        if not self.archived and active_count <= 1:
            raise LastActivePaymentMethod()

    def label(self) -> PaymentMethodLabel:
        assert self.id is not None, "only a stored method has a label"
        return PaymentMethodLabel(id=self.id, name=self.name.value, icon=self.icon.value)


@dataclass(frozen=True)
class PaymentMethodSeed:
    """A method a business is opened with: the name and icon, before it is stored."""

    name: PaymentMethodName
    icon: PaymentMethodIcon
