"""`PhoneNumber.display`: a stored number grouped by its own country's rule, with only
" " and "-" inserted, and a number that fits no template returned as stored."""

import pytest

from app.customers.domain.customer import PhoneNumber
from app.shared.phone_country import PhoneCountry, listed_countries

TABLE = [
    ("+5491123456789", "+54 9 11 2345-6789"),
    ("+59899123456", "+598 99 123 456"),
    ("+56912345678", "+56 9 1234 5678"),
    ("+595981123456", "+595 981 123456"),
    ("+59521123456", "+595 21 123456"),
    ("+5511912345678", "+55 11 91234-5678"),
    ("+551112345678", "+55 11 1234-5678"),
    ("+525512345678", "+52 55 1234 5678"),
    ("+34612345678", "+34 612 345 678"),
    ("+12125551234", "+1 212 555-1234"),
]

# An unlisted code, and listed countries at a length with no template. "+5212345" of the
# brief has 7 digits, which `PhoneNumber` itself refuses (8 to 15), so the shortest
# Mexican number it can hold stands for it; the bare 7 digits are tested on `grouped`.
FALLBACKS = ["+59312345678", "+52123456", "+1212555123"]


def _generated(country: PhoneCountry, length: int) -> str:
    rule = country.rule
    nine = rule.mobile_nine or ""
    body = "".join(str((index % 9) + 1) for index in range(length))
    return f"+{rule.calling_code}{nine}{body}"


GENERATED_FITTING = [
    _generated(country, length)
    for country in listed_countries()
    for length in sorted(country.rule.national_lengths)
]

GENERATED_NOT_FITTING = [
    _generated(country, length)
    for country in listed_countries()
    if country is not PhoneCountry.AR  # AR is canonical only at +549 and 10 digits
    for length in (min(country.rule.national_lengths) - 1, max(country.rule.national_lengths) + 1)
    if length not in country.rule.national_lengths
]


@pytest.mark.parametrize(("stored", "shown"), TABLE)
def test_a_stored_number_is_grouped_by_its_own_countrys_rule(stored: str, shown: str) -> None:
    assert PhoneNumber(stored).display == shown


@pytest.mark.parametrize("stored", FALLBACKS + GENERATED_NOT_FITTING)
def test_a_number_that_fits_no_template_is_returned_as_stored(stored: str) -> None:
    assert PhoneNumber(stored).display == stored


@pytest.mark.parametrize(
    "stored",
    [stored for stored, _ in TABLE] + FALLBACKS + GENERATED_FITTING + GENERATED_NOT_FITTING,
)
def test_display_only_inserts_spaces_and_dashes(stored: str) -> None:
    shown = PhoneNumber(stored).display

    assert shown.replace(" ", "").replace("-", "") == stored


def test_a_generated_number_per_country_and_length_is_grouped() -> None:
    assert len(GENERATED_FITTING) == 10
    for stored in GENERATED_FITTING:
        assert PhoneNumber(stored).display != stored


def test_the_generated_numbers_that_do_not_fit_cover_every_country_but_argentina() -> None:
    assert len(GENERATED_NOT_FITTING) >= 7
