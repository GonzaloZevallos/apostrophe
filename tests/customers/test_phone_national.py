"""`PhoneNumber.national`: the listed country and the national part grouped by its
template, and what happens when that text is typed back with its country."""

from typing import Literal

import pytest

from app.customers.domain.customer import InvalidPhoneNumber, PhoneNumber
from app.shared.phone_country import PhoneCountry, grouped, listed_countries


@pytest.mark.parametrize("country", listed_countries(), ids=lambda country: country.value)
def test_the_national_part_of_each_countrys_example_round_trips(country: PhoneCountry) -> None:
    stored = PhoneNumber.of(country.rule.example, country)

    national = stored.national

    assert national is not None
    assert national[0] is country
    international = grouped(stored.digits)
    assert international is not None
    assert international.endswith(national[1])
    assert PhoneNumber.of(national[1], country).value == stored.value


@pytest.mark.parametrize("country", listed_countries(), ids=lambda country: country.value)
def test_the_national_text_only_adds_separators_to_the_national_digits(
    country: PhoneCountry,
) -> None:
    stored = PhoneNumber.of(country.rule.example, country)
    national = stored.national
    assert national is not None

    rule = country.rule
    expected = stored.digits[len(rule.calling_code) :]
    if rule.mobile_nine is not None:
        expected = expected[len(rule.mobile_nine) :]

    assert national[1].replace(" ", "").replace("-", "") == expected


def test_an_unlisted_plus_number_has_no_national_part() -> None:
    assert PhoneNumber.of("+44 20 7946 0958", None).national is None


@pytest.mark.parametrize("stored", ["+541123456789", "+5411234567890"])
def test_an_argentine_number_without_its_mobile_nine_is_never_stored(stored: str) -> None:
    # `PhoneNumber` cannot hold it, so its `national` is never asked; `grouped` and
    # `national_grouped` give None for it together (tests/shared/test_national_grouped.py).
    with pytest.raises(InvalidPhoneNumber):
        PhoneNumber(stored)


Outcome = Literal["round_trips", "refused"] | tuple[Literal["reads_as"], str]

# Each row pins what the code does today; the screen part must never send an untouched
# `phone_local` text back because of the rows that are not "round_trips".
EDGES: list[tuple[str, PhoneCountry, Outcome]] = [
    ("+11234567890", PhoneCountry.US, "refused"),
    ("+5495412345678", PhoneCountry.AR, "refused"),
    ("+59801234567", PhoneCountry.UY, "refused"),
    ("+59501234567", PhoneCountry.PY, "refused"),
    ("+5490123456789", PhoneCountry.AR, "refused"),
    ("+5501234567890", PhoneCountry.BR, ("reads_as", "+551234567890")),
    ("+56561234567", PhoneCountry.CL, "round_trips"),
    ("+525212345678", PhoneCountry.MX, "round_trips"),
    ("+34341234567", PhoneCountry.ES, "round_trips"),
    ("+59859812345", PhoneCountry.UY, "round_trips"),
    ("+59559512345", PhoneCountry.PY, "round_trips"),
    ("+5491115123456", PhoneCountry.AR, "round_trips"),
]


@pytest.mark.parametrize(("stored", "country", "outcome"), EDGES)
def test_the_numbers_that_do_not_read_back_are_pinned_not_nulled(
    stored: str, country: PhoneCountry, outcome: Outcome
) -> None:
    number = PhoneNumber(stored)

    national = number.national
    assert national is not None
    assert national[0] is country

    if outcome == "refused":
        with pytest.raises(InvalidPhoneNumber):
            PhoneNumber.of(national[1], country)
    elif outcome == "round_trips":
        assert PhoneNumber.of(national[1], country).value == stored
    else:
        assert PhoneNumber.of(national[1], country).value == outcome[1]
