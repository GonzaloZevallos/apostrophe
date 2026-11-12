"""A business's customers, identified by their own record, not by their phone
(ADR-0021; CONTEXT.md: Customer, Phone number, VIP customer). The phone is
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
from typing import ClassVar

from app.shared.names import fold
from app.shared.phone_country import PhoneCountry, PhoneCountryRule, grouped, listed_country_of

NAME_MAX_LENGTH = 60

_SEPARATORS = " -.()"


class CustomerRuleBroken(ValueError):
    """A rule of customers was broken; the message says which, never the data."""

    code: ClassVar[str] = "customer.rule_broken"


class InvalidPhoneNumber(CustomerRuleBroken):
    code: ClassVar[str] = "customer.phone_invalid"

    def __init__(self) -> None:
        super().__init__("that doesn't look like a phone number with its area code")


class PhoneNeedsCountryCode(CustomerRuleBroken):
    """A number typed without "+" in a business that has no Phone country."""

    code: ClassVar[str] = "customer.phone_needs_country_code"

    def __init__(self) -> None:
        super().__init__(
            "a phone number without a Phone country starts with + and its country code"
        )


class MissingCustomerName(CustomerRuleBroken):
    code: ClassVar[str] = "customer.name_missing"

    def __init__(self) -> None:
        super().__init__("a customer needs a name")


class CustomerNameTooLong(CustomerRuleBroken):
    code: ClassVar[str] = "customer.name_too_long"

    def __init__(self) -> None:
        super().__init__(f"a customer name has at most {NAME_MAX_LENGTH} characters")


def _argentine_marks(rule: PhoneCountryRule) -> tuple[str, str]:
    """Argentina's mobile nine and local fifteen, which only its rule in the shared table has."""
    if rule.mobile_nine is None or rule.local_mobile_fifteen is None:
        raise ValueError("Argentina's rule carries the mobile nine and the local fifteen")
    return rule.mobile_nine, rule.local_mobile_fifteen


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
    def optional(cls, raw: str | None, country: PhoneCountry | None) -> PhoneNumber | None:
        """`None` for a missing phone, or one blank after trimming; otherwise `of`.
        The only place in the product a phone is tested for emptiness (the plan's
        invariant)."""
        if raw is None or not raw.strip():
            return None
        return cls.of(raw, country)

    @staticmethod
    def _without_separators(raw: str) -> str:
        cleaned = raw
        for separator in _SEPARATORS:
            cleaned = cleaned.replace(separator, "")
        return cleaned

    @classmethod
    def plus_digits(cls, raw: str) -> str | None:
        """What follows a leading "+" once the separators are removed, or `None` when the
        text has no "+" form. A "+" anywhere else is not one. The front's `shownCountry`
        reads "+" by the same rule (`web/src/phone/plusCases.json`)."""
        cleaned = cls._without_separators(raw)
        return cleaned[1:] if cleaned.startswith("+") else None

    @classmethod
    def of(cls, raw: str, country: PhoneCountry | None) -> PhoneNumber:
        """The canonical number of one typed by the business's Phone country (docs/adr/0082).

        With "+", a listed calling code is read by that country's rule whatever
        `country` is, and any other code is accepted as written. Without "+" the digits
        are international when they start with the country's code and fit one of its
        international lengths, and otherwise a local number of that country. There is
        no default for `country`: every caller says which one it means.
        """
        plus_digits = cls.plus_digits(raw)
        has_plus = plus_digits is not None
        rest = plus_digits if plus_digits is not None else cls._without_separators(raw)
        if "+" in rest or not rest or not rest.isdigit():
            raise InvalidPhoneNumber()

        if has_plus:
            listed = listed_country_of(rest)
            if listed is None:
                return cls(cls._from_foreign(rest))
            return cls(cls._international(listed, rest))
        if country is None:
            raise PhoneNeedsCountryCode()
        if country is PhoneCountry.AR:
            return cls(cls._argentine(rest))
        if rest.startswith(country.rule.calling_code):
            national = cls._national_after_code(country.rule, rest)
            if national is not None:
                return cls(f"+{country.rule.calling_code}{national}")
        return cls(f"+{country.rule.calling_code}{cls._local(country.rule, rest)}")

    @classmethod
    def _international(cls, country: PhoneCountry, digits: str) -> str:
        """The number typed with "+" and the calling code of a listed country."""
        if country is PhoneCountry.AR:
            return cls._argentine(digits)
        national = cls._national_after_code(country.rule, digits)
        if national is None:
            raise InvalidPhoneNumber()
        return f"+{country.rule.calling_code}{national}"

    @staticmethod
    def _national_after_code(rule: PhoneCountryRule, digits: str) -> str | None:
        """The national number of digits that start with the calling code, or `None`
        when they do not fit one of the country's lengths. Mexico drops the old
        mobile "1" after 52."""
        national = digits[len(rule.calling_code) :]
        one = rule.legacy_mobile_one
        if (
            one is not None
            and national.startswith(one)
            and len(national) - 1 in rule.national_lengths
        ):
            national = national[len(one) :]
        return national if len(national) in rule.national_lengths else None

    @staticmethod
    def _local(rule: PhoneCountryRule, digits: str) -> str:
        """A number typed the way it is said in the country: the trunk prefix is
        dropped (Brazil: and a two-digit carrier code), what is left must be a national
        length."""
        local = digits
        if rule.trunk_prefix is not None and local.startswith(rule.trunk_prefix):
            local = local[len(rule.trunk_prefix) :]
        if (
            rule.carrier_code_length
            and len(local) - rule.carrier_code_length in rule.national_lengths
        ):
            local = local[rule.carrier_code_length :]
        if len(local) not in rule.national_lengths:
            raise InvalidPhoneNumber()
        return local

    @classmethod
    def _argentine(cls, rest: str) -> str:
        """Argentina's rule, as it has always been: every number is a mobile. Its code,
        its mobile nine, its local fifteen, its trunk prefix and its length are read
        from the shared table."""
        code = PhoneCountry.AR.rule.calling_code
        if rest.startswith(code):
            return cls._from_54(rest[len(code) :])
        return cls._from_local(rest)

    @staticmethod
    def _from_54(remainder: str) -> str:
        rule = PhoneCountry.AR.rule
        nine, _ = _argentine_marks(rule)
        (length,) = rule.national_lengths
        if len(remainder) == length:
            return f"+{rule.calling_code}{nine}{remainder}"
        if len(remainder) == length + len(nine) and remainder.startswith(nine):
            return f"+{rule.calling_code}{nine}{remainder[len(nine) :]}"
        raise InvalidPhoneNumber()

    @staticmethod
    def _from_foreign(digits: str) -> str:
        if not 8 <= len(digits) <= 15 or digits.startswith("0"):
            raise InvalidPhoneNumber()
        return "+" + digits

    @staticmethod
    def _from_local(digits: str) -> str:
        rule = PhoneCountry.AR.rule
        nine, fifteen = _argentine_marks(rule)
        (length,) = rule.national_lengths
        trunk = rule.trunk_prefix or ""
        local = digits[len(trunk) :] if trunk and digits.startswith(trunk) else digits
        if len(local) == length + len(fifteen):
            local = PhoneNumber._without_15(local, fifteen)
        if len(local) != length:
            raise InvalidPhoneNumber()
        return f"+{rule.calling_code}{nine}{local}"

    @staticmethod
    def _without_15(local: str, fifteen: str) -> str:
        for index in (2, 3, 4):
            if local[index : index + len(fifteen)] == fifteen:
                return local[:index] + local[index + len(fifteen) :]
        raise InvalidPhoneNumber()

    @property
    def digits(self) -> str:
        return self.value[1:]

    @property
    def display(self) -> str:
        """The number grouped by its own country's rule, for a read response only; a
        number that fits no template is the stored value."""
        return grouped(self.digits) or self.value


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


@dataclass
class Customer:
    """The aggregate root: a name, a phone number and the customer type they are in, or
    none. Whether that type is the business's VIP type is for the readers to compare
    (docs/adr/0070); the aggregate holds no VIP mark."""

    name: CustomerName
    phone: PhoneNumber | None
    id: int | None = None
    customer_type_id: int | None = None

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
