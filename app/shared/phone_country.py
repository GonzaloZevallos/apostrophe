"""The countries a business can set as its Phone country (CONTEXT.md: Phone country,
docs/adr/0082). The one place a calling code, a national length or a trunk prefix is
written: the customers domain reads its rules from here, accounts validates against the
enum, and the front holds only the names and what the API sends it. Each rule also holds
the templates that group a number for display and the example a seller types. Standard
library only."""

from collections.abc import Mapping
from dataclasses import dataclass, field
from enum import Enum
from types import MappingProxyType
from typing import ClassVar


class UnknownPhoneCountry(Exception):
    """A code that is not one of the listed countries."""

    code: ClassVar[str] = "customer.phone_country_unknown"

    def __init__(self) -> None:
        super().__init__("The phone country is not one a business can choose")


class PhoneCountry(Enum):
    """ISO 3166-1 alpha-2 codes, in the order Settings lists them."""

    AR = "AR"
    UY = "UY"
    CL = "CL"
    PY = "PY"
    BR = "BR"
    MX = "MX"
    ES = "ES"
    US = "US"

    @classmethod
    def parse(cls, code: str) -> "PhoneCountry":
        """The country of a stored or requested code; any other string is refused."""
        try:
            return cls(code)
        except ValueError:
            raise UnknownPhoneCountry from None

    @property
    def rule(self) -> "PhoneCountryRule":
        return RULES[self]


@dataclass(frozen=True)
class PhoneCountryRule:
    calling_code: str
    # The valid lengths of the national number, trunk prefix excluded.
    national_lengths: frozenset[int]
    # One template per national length for display: `#` is a digit, and only " " and "-"
    # may separate. Read-only after construction; out of the hash because a mapping has none.
    groupings: Mapping[int, str] = field(hash=False)
    # The local form a seller types, shown as the placeholder of the phone field.
    example: str
    trunk_prefix: str | None = None
    # Brazil: a two-digit carrier code may follow the trunk prefix.
    carrier_code_length: int = 0
    # Argentina only: the "9" after 54 that marks a mobile and the "15" typed locally.
    mobile_nine: str | None = None
    local_mobile_fifteen: str | None = None
    # Mexico only: the old mobile "1" after 52, dropped when read.
    legacy_mobile_one: str | None = None

    def __post_init__(self) -> None:
        if not self.national_lengths:
            raise ValueError("a country needs at least one national length")
        if set(self.groupings) - self.national_lengths:
            raise ValueError("a grouping is for a national length")
        if self.national_lengths - set(self.groupings):
            raise ValueError("every national length needs a grouping")
        for length, template in self.groupings.items():
            if set(template) - set("# -"):
                raise ValueError("only a space and a dash may separate the digits of a grouping")
            if template.count("#") != length:
                raise ValueError("a grouping must have one # per digit")
        if not self.example.strip():
            raise ValueError("a country needs an example")
        object.__setattr__(self, "groupings", MappingProxyType(dict(self.groupings)))

    @property
    def international_lengths(self) -> frozenset[int]:
        """The digit counts of the calling code plus the national number."""
        return frozenset(len(self.calling_code) + length for length in self.national_lengths)


RULES: dict[PhoneCountry, PhoneCountryRule] = {
    PhoneCountry.AR: PhoneCountryRule(
        "54",
        frozenset({10}),
        groupings={10: "## ####-####"},
        example="11 2345-6789",
        trunk_prefix="0",
        mobile_nine="9",
        local_mobile_fifteen="15",
    ),
    PhoneCountry.UY: PhoneCountryRule(
        "598",
        frozenset({8}),
        groupings={8: "## ### ###"},
        example="099 123 456",
        trunk_prefix="0",
    ),
    PhoneCountry.CL: PhoneCountryRule(
        "56", frozenset({9}), groupings={9: "# #### ####"}, example="9 1234 5678"
    ),
    PhoneCountry.PY: PhoneCountryRule(
        "595",
        frozenset({8, 9}),
        groupings={9: "### ######", 8: "## ######"},
        example="0981 123 456",
        trunk_prefix="0",
    ),
    PhoneCountry.BR: PhoneCountryRule(
        "55",
        frozenset({10, 11}),
        groupings={11: "## #####-####", 10: "## ####-####"},
        example="(11) 91234-5678",
        trunk_prefix="0",
        carrier_code_length=2,
    ),
    PhoneCountry.MX: PhoneCountryRule(
        "52",
        frozenset({10}),
        groupings={10: "## #### ####"},
        example="55 1234 5678",
        legacy_mobile_one="1",
    ),
    PhoneCountry.ES: PhoneCountryRule(
        "34", frozenset({9}), groupings={9: "### ### ###"}, example="612 34 56 78"
    ),
    PhoneCountry.US: PhoneCountryRule(
        "1",
        frozenset({10}),
        groupings={10: "### ###-####"},
        example="(212) 555-0123",
        trunk_prefix="1",
    ),
}


def listed_countries() -> tuple[PhoneCountry, ...]:
    """The listed countries in the order Settings lists them; the one owner of that order."""
    return tuple(PhoneCountry)


def listed_country_of(digits: str) -> PhoneCountry | None:
    """The listed country whose calling code the digits start with, or `None`. The
    codes are prefix-free, so at most one matches."""
    for country, rule in RULES.items():
        if digits.startswith(rule.calling_code):
            return country
    return None


def grouped(digits: str) -> str | None:
    """The digits (no "+") as `+<code> [<mobile nine> ]<national number grouped>`, or
    `None` when the number cannot be grouped: an unlisted code, a missing mobile nine, or
    a national length with no template. Only " " and "-" are ever inserted."""
    country = listed_country_of(digits)
    if country is None:
        return None
    rule = country.rule
    national = digits[len(rule.calling_code) :]
    lead = f"+{rule.calling_code} "
    if rule.mobile_nine is not None:
        if not national.startswith(rule.mobile_nine):
            return None
        national = national[len(rule.mobile_nine) :]
        lead += f"{rule.mobile_nine} "
    template = rule.groupings.get(len(national))
    if template is None:
        return None
    remaining = iter(national)
    return lead + "".join(next(remaining) if char == "#" else char for char in template)
