"""The rules of a customer, their phone number and their name, with no infrastructure."""

import random

import pytest

from app.customers.domain.customer import (
    Customer,
    CustomerName,
    CustomerNameTooLong,
    CustomerRuleBroken,
    InvalidPhoneNumber,
    MissingCustomerName,
    PhoneNeedsCountryCode,
    PhoneNumber,
)
from app.shared.names import fold
from app.shared.phone_country import PhoneCountry

# -- fold ---------------------------------------------------------------------------


def test_fold_drops_accents_casefolds_and_collapses_whitespace() -> None:
    assert fold("  Álvaro   NÚÑEZ ") == "alvaro nunez"


# -- PhoneNumber.of: the PRD's required matrix ---------------------------------------


@pytest.mark.parametrize(
    "raw",
    [
        "11 2345-6789",
        "011 15 2345-6789",
        "+54 9 11 2345 6789",
        "5491123456789",
        "541123456789",
        "+541123456789",
    ],
)
def test_the_required_matrix_all_normalise_to_the_same_number(raw: str) -> None:
    assert PhoneNumber.of(raw, PhoneCountry.AR).value == "+5491123456789"


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("0351 15 123-4567", "+5493511234567"),
        ("02964 15 12-3456", "+5492964123456"),
        ("+1 (415) 555-2671", "+14155552671"),
        ("+44345678", "+44345678"),
        ("+443456789012345", "+443456789012345"),
    ],
)
def test_further_normalisation_cases(raw: str, expected: str) -> None:
    assert PhoneNumber.of(raw, PhoneCountry.AR).value == expected


@pytest.mark.parametrize(
    "raw",
    [
        "2345-6789",
        "11 2345 678",
        "11 2345 67890",
        "+54 11 2345 678",
        "abc",
        "",
        "+0123456789",
        "11+2345678",
        "+1234567",
        "+1234567890123456",
    ],
)
def test_invalid_phone_numbers_are_refused(raw: str) -> None:
    with pytest.raises(InvalidPhoneNumber):
        PhoneNumber.of(raw, PhoneCountry.AR)


@pytest.mark.parametrize(
    "raw",
    [
        "2345-6789",
        "11 2345 678",
        "11 2345 67890",
        "+54 11 2345 678",
        "abc",
        "+0123456789",
        "11+2345678",
    ],
)
def test_a_phone_refusal_never_carries_a_digit(raw: str) -> None:
    with pytest.raises(InvalidPhoneNumber) as excinfo:
        PhoneNumber.of(raw, PhoneCountry.AR)

    assert not any(c.isdigit() for c in str(excinfo.value))


def test_phone_number_rejects_a_non_canonical_value_built_directly() -> None:
    with pytest.raises(InvalidPhoneNumber):
        PhoneNumber("5491123456789")  # missing the leading +


def test_phone_number_rejects_a_54_value_that_is_not_549_plus_ten_digits() -> None:
    with pytest.raises(InvalidPhoneNumber):
        PhoneNumber("+5411234567890")


def test_phone_number_digits_drops_the_plus() -> None:
    assert PhoneNumber.of("11 2345-6789", PhoneCountry.AR).digits == "5491123456789"


# -- PhoneNumber.optional -------------------------------------------------------------


def test_optional_is_none_for_a_missing_phone() -> None:
    assert PhoneNumber.optional(None, PhoneCountry.AR) is None


@pytest.mark.parametrize("raw", ["", "   "])
def test_optional_is_none_for_a_blank_phone(raw: str) -> None:
    assert PhoneNumber.optional(raw, PhoneCountry.AR) is None


def test_optional_normalises_a_real_phone_the_same_as_of() -> None:
    assert PhoneNumber.optional("11 2345-6789", PhoneCountry.AR) == PhoneNumber.of(
        "11 2345-6789", PhoneCountry.AR
    )


def test_optional_still_refuses_a_malformed_non_blank_phone() -> None:
    with pytest.raises(InvalidPhoneNumber):
        PhoneNumber.optional("2345-6789", PhoneCountry.AR)


# -- US: "+1" is a listed code now (docs/adr/0082) -------------------------------------


@pytest.mark.parametrize("raw", ["+12345678", "+123456789012345", "+1234567", "+1 415 555 267"])
def test_plus_one_of_any_other_length_is_refused_with_the_generic_code(raw: str) -> None:
    with pytest.raises(InvalidPhoneNumber) as excinfo:
        PhoneNumber.of(raw, PhoneCountry.AR)

    assert excinfo.value.code == "customer.phone_invalid"


def test_plus_one_and_ten_digits_is_accepted_and_the_same_typed_locally() -> None:
    plus = PhoneNumber.of("+1 (415) 555-2671", PhoneCountry.AR)

    assert plus.value == "+14155552671"
    assert PhoneNumber.of("415 555 2671", PhoneCountry.US) == plus
    assert PhoneNumber.of("1 415 555 2671", PhoneCountry.US) == plus


# -- a number without "+" in a business with no Phone country -------------------------


@pytest.mark.parametrize("raw", ["11 2345-6789", "5491123456789", "0351 15 123-4567"])
def test_a_number_without_plus_and_no_country_needs_the_country_code(raw: str) -> None:
    with pytest.raises(PhoneNeedsCountryCode) as excinfo:
        PhoneNumber.of(raw, None)

    assert excinfo.value.code == "customer.phone_needs_country_code"
    assert not any(c.isdigit() for c in str(excinfo.value))


def test_a_plus_number_is_accepted_with_no_country() -> None:
    assert PhoneNumber.of("+598 99 123 456", None).value == "+59899123456"
    assert PhoneNumber.of("+44 345 678", None).value == "+44345678"


@pytest.mark.parametrize("raw", ["abc", "11+2345678", "+0123456789", "+"])
def test_a_malformed_number_with_no_country_is_the_generic_refusal(raw: str) -> None:
    with pytest.raises(InvalidPhoneNumber):
        PhoneNumber.of(raw, None)


def test_optional_with_no_country_still_answers_none_for_a_blank() -> None:
    assert PhoneNumber.optional("  ", None) is None
    with pytest.raises(PhoneNeedsCountryCode):
        PhoneNumber.optional("099 123 456", None)


# -- a matrix per country --------------------------------------------------------------

# Every equivalent spelling of one number, and the stored value they all give.
EQUIVALENT: dict[PhoneCountry, tuple[str, list[str]]] = {
    PhoneCountry.AR: (
        "+5491123456789",
        ["11 2345-6789", "011 15 2345-6789", "5491123456789", "+54 9 11 2345 6789"],
    ),
    PhoneCountry.UY: (
        "+59899123456",
        ["99 123 456", "099 123 456", "099-123-456", "59899123456", "+598 99 123 456"],
    ),
    PhoneCountry.CL: (
        "+56912345678",
        ["9 1234 5678", "9-1234-5678", "56912345678", "+56 9 1234 5678"],
    ),
    PhoneCountry.PY: (
        "+595981123456",
        ["981 123 456", "0981 123 456", "595981123456", "+595 981 123 456"],
    ),
    PhoneCountry.BR: (
        "+5511912345678",
        [
            "11 91234-5678",
            "(11) 91234-5678",
            "011 91234-5678",
            "0 15 11 91234-5678",
            "5511912345678",
            "+55 11 91234 5678",
        ],
    ),
    PhoneCountry.MX: (
        "+525512345678",
        ["55 1234 5678", "55-1234-5678", "525512345678", "+52 55 1234 5678", "+52 1 55 1234 5678"],
    ),
    PhoneCountry.ES: (
        "+34612345678",
        ["612 34 56 78", "612345678", "34612345678", "+34 612 34 56 78"],
    ),
    PhoneCountry.US: (
        "+12125550123",
        ["212 555-0123", "(212) 555-0123", "1 212 555 0123", "12125550123", "+1 212 555 0123"],
    ),
}

# Brazil and Paraguay take more than one length.
SECOND_LENGTH: dict[PhoneCountry, tuple[str, list[str]]] = {
    PhoneCountry.BR: ("+551134567890", ["11 3456-7890", "011 3456-7890", "+55 11 3456 7890"]),
    PhoneCountry.PY: ("+59521123456", ["21 123 456", "021 123 456", "+595 21 123 456"]),
}

# A form every country refuses: too short, too long, and letters.
REFUSED_EVERYWHERE = ["123", "12345678901234567", "99 abc 456", "99 123+456", "+", "+598"]


@pytest.mark.parametrize("country", list(PhoneCountry))
def test_every_equivalent_spelling_gives_one_stored_value(country: PhoneCountry) -> None:
    expected, spellings = EQUIVALENT[country]

    assert {PhoneNumber.of(raw, country).value for raw in spellings} == {expected}


@pytest.mark.parametrize("country", list(SECOND_LENGTH))
def test_a_country_with_a_second_national_length_accepts_it(country: PhoneCountry) -> None:
    expected, spellings = SECOND_LENGTH[country]

    assert {PhoneNumber.of(raw, country).value for raw in spellings} == {expected}


@pytest.mark.parametrize("country", list(PhoneCountry))
@pytest.mark.parametrize("raw", REFUSED_EVERYWHERE)
def test_an_invalid_form_is_refused_in_every_country(country: PhoneCountry, raw: str) -> None:
    with pytest.raises(InvalidPhoneNumber) as excinfo:
        PhoneNumber.of(raw, country)

    assert not any(c.isdigit() for c in str(excinfo.value))


@pytest.mark.parametrize(
    ("country", "raw"),
    [
        (PhoneCountry.UY, "99 123 45"),
        (PhoneCountry.UY, "99 123 4567"),
        (PhoneCountry.CL, "1234 5678"),
        (PhoneCountry.PY, "981 123 4567"),
        (PhoneCountry.PY, "981 12 34"),
        (PhoneCountry.BR, "11 1234-567"),
        (PhoneCountry.BR, "11 91234-5678901"),
        (PhoneCountry.MX, "55 1234 567"),
        (PhoneCountry.MX, "55 1234 56789"),
        (PhoneCountry.ES, "612 34 56 7"),
        (PhoneCountry.ES, "612 34 56 789"),
        (PhoneCountry.US, "212 555 012"),
        (PhoneCountry.US, "212 555 01234"),
    ],
)
def test_a_wrong_national_length_is_refused(country: PhoneCountry, raw: str) -> None:
    with pytest.raises(InvalidPhoneNumber):
        PhoneNumber.of(raw, country)


@pytest.mark.parametrize(
    ("country", "raw"),
    [
        (PhoneCountry.UY, "+598 99 123"),
        (PhoneCountry.CL, "+56 9 1234 56789"),
        (PhoneCountry.PY, "+595 981 123 4567"),
        (PhoneCountry.BR, "+55 11 1234 567"),
        (PhoneCountry.MX, "+52 55 1234 567"),
        (PhoneCountry.ES, "+34 612 34 56"),
        (PhoneCountry.US, "+1 212 555 012"),
        (PhoneCountry.AR, "+54 11 2345 678"),
    ],
)
def test_a_plus_number_of_a_listed_code_that_does_not_fit_is_refused_in_any_country(
    country: PhoneCountry, raw: str
) -> None:
    for current in (country, PhoneCountry.AR, None):
        with pytest.raises(InvalidPhoneNumber):
            PhoneNumber.of(raw, current)


@pytest.mark.parametrize("country", list(PhoneCountry))
def test_a_plus_number_of_another_listed_country_follows_that_countrys_rule(
    country: PhoneCountry,
) -> None:
    for other, (expected, spellings) in EQUIVALENT.items():
        international = spellings[-1]
        assert international.startswith("+")
        assert PhoneNumber.of(international, country).value == expected, other


def test_only_argentina_reads_a_landline_as_a_mobile() -> None:
    assert PhoneNumber.of("11 2345-6789", PhoneCountry.AR).value.startswith("+549")
    assert PhoneNumber.of("+54 11 2345 6789", PhoneCountry.UY).value.startswith("+549")
    assert PhoneNumber.of("21 123 456", PhoneCountry.PY).value == "+59521123456"
    assert PhoneNumber.of("212 555 0123", PhoneCountry.US).value == "+12125550123"


@pytest.mark.parametrize("country", list(PhoneCountry))
def test_a_canonical_output_comes_back_unchanged_under_every_country_and_none(
    country: PhoneCountry,
) -> None:
    expected, spellings = EQUIVALENT[country]
    values = {expected, *(PhoneNumber.of(raw, country).value for raw in spellings)}
    values |= {
        PhoneNumber.of(raw, country).value for raw in SECOND_LENGTH.get(country, ("", []))[1]
    }

    for value in values:
        for current in (*PhoneCountry, None):
            assert PhoneNumber.of(value, current).value == value
            assert PhoneNumber(value).value == value


# -- a property per country over generated digit strings -------------------------------


def _fits_international(country: PhoneCountry, digits: str) -> str | None:
    """The oracle: the stored value if the digits start with the code and have one of
    the country's international lengths (Mexico: or the old mobile "1" after 52)."""
    rule = country.rule
    if not digits.startswith(rule.calling_code):
        return None
    national = digits[len(rule.calling_code) :]
    if rule.legacy_mobile_one and national.startswith(rule.legacy_mobile_one):
        if len(national) - 1 in rule.national_lengths:
            national = national[1:]
    if len(national) in rule.national_lengths:
        return f"+{rule.calling_code}{national}"
    return None


def _fits_local(country: PhoneCountry, digits: str) -> str | None:
    rule = country.rule
    local = digits
    if rule.trunk_prefix and local.startswith(rule.trunk_prefix):
        local = local[len(rule.trunk_prefix) :]
    if rule.carrier_code_length and len(local) - rule.carrier_code_length in rule.national_lengths:
        local = local[rule.carrier_code_length :]
    if len(local) in rule.national_lengths:
        return f"+{rule.calling_code}{local}"
    return None


def _digit_strings(country: PhoneCountry) -> list[str]:
    """Seeded random digit strings, biased to start with the country's code or trunk so
    both readings are exercised, plus every length around the valid ones."""
    rule = country.rule
    rng = random.Random(f"phone-{country.value}")
    starts = ["", rule.calling_code, rule.trunk_prefix or "", "0", "1", "9"]
    strings = []
    for _ in range(1500):
        start = rng.choice(starts)
        length = rng.randint(1, 15)
        body = "".join(rng.choice("0123456789") for _ in range(max(length - len(start), 0)))
        strings.append(start + body)
    return strings


@pytest.mark.parametrize("country", [c for c in PhoneCountry if c is not PhoneCountry.AR])
def test_a_generated_string_reads_as_international_or_local_and_agrees_when_both(
    country: PhoneCountry,
) -> None:
    both = 0
    for digits in _digit_strings(country):
        international = _fits_international(country, digits)
        local = _fits_local(country, digits)
        if international is None and local is None:
            with pytest.raises(InvalidPhoneNumber):
                PhoneNumber.of(digits, country)
            continue
        if international is not None and local is not None:
            both += 1
            assert international == local, digits
        assert PhoneNumber.of(digits, country).value == (international or local)
    if country in (PhoneCountry.US, PhoneCountry.BR):
        assert both > 0


@pytest.mark.parametrize("country", list(PhoneCountry))
def test_a_generated_string_that_is_accepted_is_canonical_and_stable(
    country: PhoneCountry,
) -> None:
    for digits in _digit_strings(country):
        try:
            value = PhoneNumber.of(digits, country).value
        except InvalidPhoneNumber:
            continue
        assert PhoneNumber.of(value, None).value == value


# -- CustomerName.of ------------------------------------------------------------------


def test_a_name_is_trimmed_and_its_inner_spaces_collapsed() -> None:
    assert CustomerName.of("  Fran   Araujo ").value == "Fran Araujo"


@pytest.mark.parametrize("raw", ["", "   "])
def test_an_empty_name_is_refused(raw: str) -> None:
    with pytest.raises(MissingCustomerName):
        CustomerName.of(raw)


def test_a_name_of_exactly_sixty_characters_is_accepted() -> None:
    name = CustomerName.of("x" * 60)

    assert len(name.value) == 60


def test_a_name_of_sixty_one_characters_is_refused() -> None:
    with pytest.raises(CustomerNameTooLong):
        CustomerName.of("x" * 61)


def test_customer_name_too_long_is_a_customer_rule_broken() -> None:
    assert issubclass(CustomerNameTooLong, CustomerRuleBroken)
    assert issubclass(InvalidPhoneNumber, CustomerRuleBroken)
    assert issubclass(MissingCustomerName, CustomerRuleBroken)


# -- Customer.matches -----------------------------------------------------------------


def _alvaro(customer_id: int | None = None) -> Customer:
    return Customer(
        name=CustomerName.of("Álvaro Núñez"),
        phone=PhoneNumber.of("11 2345-6789", PhoneCountry.AR),
        id=customer_id,
    )


def _zoe(customer_id: int | None = None) -> Customer:
    return Customer(
        name=CustomerName.of("Zoe"),
        phone=PhoneNumber.of("11 9876-5432", PhoneCountry.AR),
        id=customer_id,
    )


def test_matches_by_name_is_case_and_accent_insensitive() -> None:
    assert _alvaro().matches("alv")
    assert _alvaro().matches("ÁLV")


def test_a_query_matching_one_name_does_not_match_another() -> None:
    assert not _zoe().matches("Fran")


@pytest.mark.parametrize("query", ["011 2345", "2345"])
def test_matches_by_a_substring_of_the_phone_digits(query: str) -> None:
    assert _alvaro().matches(query)


@pytest.mark.parametrize("query", ["", "   "])
def test_an_empty_query_matches_everyone(query: str) -> None:
    assert _alvaro().matches(query)
    assert _zoe().matches(query)


def test_a_query_with_no_digits_and_no_name_overlap_matches_no_one() -> None:
    assert not _alvaro().matches("-")


def test_a_query_matches_when_its_characters_appear_in_a_name_with_a_dash() -> None:
    dashed = Customer(
        name=CustomerName.of("Jo-Jo"), phone=PhoneNumber.of("11 1111-1111", PhoneCountry.AR)
    )

    assert dashed.matches("-")


# -- Customer.sort_key -----------------------------------------------------------------


def _sin_numero(customer_id: int | None = None) -> Customer:
    return Customer(name=CustomerName.of("Sin Numero"), phone=None, id=customer_id)


def test_a_customer_with_no_phone_still_matches_by_name() -> None:
    assert _sin_numero().matches("Sin")


def test_a_customer_with_no_phone_never_matches_on_the_number_branch() -> None:
    assert not _sin_numero().matches("2345")


def test_two_customers_with_no_phone_both_match_an_empty_query() -> None:
    assert _sin_numero(1).matches("")
    assert _sin_numero(2).matches("")


def test_sort_key_orders_by_folded_name() -> None:
    customers = [_zoe(), _alvaro()]

    customers.sort(key=lambda c: c.sort_key)

    assert [c.name.value for c in customers] == ["Álvaro Núñez", "Zoe"]


def test_sort_key_breaks_ties_between_equal_names_by_id() -> None:
    first = Customer(
        name=CustomerName.of("Zoe"), phone=PhoneNumber.of("11 1111-1111", PhoneCountry.AR), id=2
    )
    second = Customer(
        name=CustomerName.of("Zoe"), phone=PhoneNumber.of("11 2222-2222", PhoneCountry.AR), id=1
    )

    ordered = sorted([first, second], key=lambda c: c.sort_key)

    assert first.phone is not None and second.phone is not None
    assert [c.phone.value for c in ordered if c.phone is not None] == [
        second.phone.value,
        first.phone.value,
    ]
