"""A business's customers, identified by their own record, not by their phone
(ADR-0019; CONTEXT.md: Customer, Phone number, Channel, VIP customer). The phone is
optional contact data: a customer can have none.

`PhoneNumber.of` is the only place a phone number is normalised; nothing else in the
product reimplements any part of it. `PhoneNumber.optional` is the only place a blank
or missing phone becomes "no number" (the plan's invariant): nothing else in the
product tests a phone for emptiness or rewrites it to `None`. `fold` is the only place
a name is folded for search or sort; the table that stores customers keeps no folded
copy.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum
from typing import ClassVar

from app.shared.names import fold

NAME_MAX_LENGTH = 60

_SEPARATORS = " -.()"


class CustomerRuleBroken(ValueError):
    """A rule of customers was broken; the message says which, never the data."""

    code: ClassVar[str] = "customer.rule_broken"


class InvalidPhoneNumber(CustomerRuleBroken):
    code: ClassVar[str] = "customer.phone_invalid"

    def __init__(self) -> None:
        super().__init__("that doesn't look like a phone number with its area code")


class MissingCustomerName(CustomerRuleBroken):
    code: ClassVar[str] = "customer.name_missing"

    def __init__(self) -> None:
        super().__init__("a customer needs a name")


class CustomerNameTooLong(CustomerRuleBroken):
    code: ClassVar[str] = "customer.name_too_long"

    def __init__(self) -> None:
        super().__init__(f"a customer name has at most {NAME_MAX_LENGTH} characters")


@dataclass(frozen=True)
class PhoneNumber:
    """A canonical international phone number: ``+`` and 8 to 15 digits, with no
    leading 0 after the ``+``. An Argentine number (country code 54) is always a
    mobile, stored as ``+549`` and its 10 digits (PRD: every Argentine landline is
    treated as a mobile).

    Only `of` turns a number as typed into this canonical form; the constructor
    itself only checks that a value is already canonical.
    """

    value: str

    def __post_init__(self) -> None:
        if not self._is_canonical(self.value):
            raise InvalidPhoneNumber()

    @staticmethod
    def _is_canonical(value: str) -> bool:
        if not value.startswith("+"):
            return False
        digits = value[1:]
        if not digits or not digits.isdigit():
            return False
        if digits.startswith("0"):
            return False
        if not 8 <= len(digits) <= 15:
            return False
        if value.startswith("+54"):
            return value.startswith("+549") and len(digits) == 13
        return True

    @classmethod
    def optional(cls, raw: str | None) -> PhoneNumber | None:
        """`None` for a missing phone, or one blank after trimming; otherwise `of`.
        The only place in the product a phone is tested for emptiness (the plan's
        invariant)."""
        if raw is None or not raw.strip():
            return None
        return cls.of(raw)

    @classmethod
    def of(cls, raw: str) -> PhoneNumber:
        cleaned = raw
        for separator in _SEPARATORS:
            cleaned = cleaned.replace(separator, "")

        has_plus = cleaned.startswith("+")
        rest = cleaned[1:] if has_plus else cleaned
        if "+" in rest or not rest or not rest.isdigit():
            raise InvalidPhoneNumber()

        if rest.startswith("54"):
            return cls(cls._from_54(rest[2:]))
        if has_plus:
            return cls(cls._from_foreign(rest))
        return cls(cls._from_local(rest))

    @staticmethod
    def _from_54(remainder: str) -> str:
        if len(remainder) == 10:
            return "+549" + remainder
        if len(remainder) == 11 and remainder[0] == "9":
            return "+549" + remainder[1:]
        raise InvalidPhoneNumber()

    @staticmethod
    def _from_foreign(digits: str) -> str:
        if not 8 <= len(digits) <= 15 or digits.startswith("0"):
            raise InvalidPhoneNumber()
        return "+" + digits

    @staticmethod
    def _from_local(digits: str) -> str:
        local = digits[1:] if digits.startswith("0") else digits
        if len(local) == 12:
            local = PhoneNumber._without_15(local)
        if len(local) != 10:
            raise InvalidPhoneNumber()
        return "+549" + local

    @staticmethod
    def _without_15(local: str) -> str:
        for index in (2, 3, 4):
            if local[index : index + 2] == "15":
                return local[:index] + local[index + 2 :]
        raise InvalidPhoneNumber()

    @property
    def digits(self) -> str:
        return self.value[1:]


@dataclass(frozen=True)
class CustomerName:
    """A customer's name, trimmed and with inner whitespace collapsed. Not unique."""

    value: str

    def __post_init__(self) -> None:
        if not self.value:
            raise MissingCustomerName()
        if len(self.value) > NAME_MAX_LENGTH:
            raise CustomerNameTooLong()

    @classmethod
    def of(cls, raw: str) -> CustomerName:
        return cls(" ".join(raw.split()))


class Channel(StrEnum):
    TELEGRAM = "telegram"
    WHATSAPP = "whatsapp"


@dataclass
class Customer:
    """The aggregate root: a name, a phone number, a channel and whether they are
    VIP, and nothing else in this feature (PRD)."""

    name: CustomerName
    phone: PhoneNumber | None
    channel: Channel | None = None
    vip: bool = False
    id: int | None = None

    def matches(self, query: str) -> bool:
        stripped = query.strip()
        if not stripped:
            return True
        if fold(stripped) in fold(self.name.value):
            return True
        if self.phone is None:
            return False
        digits = "".join(c for c in stripped if c.isdigit())
        if digits.startswith("0"):
            digits = digits[1:]
        return bool(digits) and digits in self.phone.digits

    @property
    def sort_key(self) -> tuple[str, int]:
        return (fold(self.name.value), self.id or 0)
