"""`national_grouped` and `grouped` share one split: they are `None` together and the
national text of one is the tail of the other."""

import pytest

from app.customers.domain.customer import PhoneNumber
from app.shared.phone_country import PhoneCountry, grouped, listed_countries, national_grouped

EXAMPLES = [PhoneNumber.of(country.rule.example, country).digits for country in listed_countries()]

# Numbers that read back differently or not at all from their national text.
EDGES = [
    "11234567890",  # US, national part starts with the trunk 1
    "5495412345678",  # AR, national part starts with 54
    "59801234567",  # UY, trunk 0
    "59501234567",  # PY, trunk 0 (8 digits)
    "5490123456789",  # AR, trunk 0
    "5501234567890",  # BR, trunk 0 then 10 digits
    "56561234567",  # CL, national part starts with its own code
    "525212345678",  # MX
    "34341234567",  # ES
    "59859812345",  # UY
    "59559512345",  # PY
    "5491115123456",  # AR, 15 inside the national part
]

NONE_CASES = [
    "59312345678",  # unlisted code
    "5411234567890",  # AR without its mobile nine
    "541123456789",  # AR, no template for that length
    "5212345",  # MX, no template for that length
    "1212555123",  # US, no template for that length
]


@pytest.mark.parametrize("digits", EXAMPLES + EDGES + NONE_CASES)
def test_the_two_groupings_are_none_together_and_otherwise_share_the_national_text(
    digits: str,
) -> None:
    international = grouped(digits)
    national = national_grouped(digits)

    if international is None:
        assert national is None
        return
    assert national is not None
    country, text = national
    lead = "9 " if country is PhoneCountry.AR else ""
    assert international == f"+{country.rule.calling_code} {lead}{text}"


@pytest.mark.parametrize("digits", NONE_CASES)
def test_national_grouped_refuses_what_grouped_refuses(digits: str) -> None:
    assert national_grouped(digits) is None


def test_national_grouped_drops_the_calling_code_and_the_mobile_nine() -> None:
    assert national_grouped("5491155550101") == (PhoneCountry.AR, "11 5555-0101")
