"""The countries a business can set as its Phone country (CONTEXT.md: Phone country,
docs/adr/0073). The one place a calling code, a national length or a trunk prefix is
written: the customers domain reads its rules from here, accounts validates against the
enum, and the front holds only the names. Standard library only."""

from dataclasses import dataclass
from enum import Enum
from typing import ClassVar


class UnknownPhoneCountry(Exception):
    """A code that is not one of the listed countries."""

    code: ClassVar[str] = "business.phone_country_unknown"

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

    @property
    def international_lengths(self) -> frozenset[int]:
        """The digit counts of the calling code plus the national number."""
        return frozenset(len(self.calling_code) + length for length in self.national_lengths)


RULES: dict[PhoneCountry, PhoneCountryRule] = {
    PhoneCountry.AR: PhoneCountryRule(
        "54",
        frozenset({10}),
        trunk_prefix="0",
        mobile_nine="9",
        local_mobile_fifteen="15",
    ),
    PhoneCountry.UY: PhoneCountryRule("598", frozenset({8}), trunk_prefix="0"),
    PhoneCountry.CL: PhoneCountryRule("56", frozenset({9})),
    PhoneCountry.PY: PhoneCountryRule("595", frozenset({8, 9}), trunk_prefix="0"),
    PhoneCountry.BR: PhoneCountryRule(
        "55", frozenset({10, 11}), trunk_prefix="0", carrier_code_length=2
    ),
    PhoneCountry.MX: PhoneCountryRule("52", frozenset({10}), legacy_mobile_one="1"),
    PhoneCountry.ES: PhoneCountryRule("34", frozenset({9})),
    PhoneCountry.US: PhoneCountryRule("1", frozenset({10}), trunk_prefix="1"),
}
