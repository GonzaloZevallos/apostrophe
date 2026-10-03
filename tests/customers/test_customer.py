"""The rules of a customer, their phone number and their name, with no infrastructure."""

import pytest

from app.customers.domain.customer import (
    Customer,
    CustomerName,
    CustomerNameTooLong,
    CustomerRuleBroken,
    InvalidPhoneNumber,
    MissingCustomerName,
    PhoneNumber,
)
from app.shared.names import fold

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
    assert PhoneNumber.of(raw).value == "+5491123456789"


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("0351 15 123-4567", "+5493511234567"),
        ("02964 15 12-3456", "+5492964123456"),
        ("+1 (415) 555-2671", "+14155552671"),
        ("+12345678", "+12345678"),
        ("+123456789012345", "+123456789012345"),
    ],
)
def test_further_normalisation_cases(raw: str, expected: str) -> None:
    assert PhoneNumber.of(raw).value == expected


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
        PhoneNumber.of(raw)


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
        PhoneNumber.of(raw)

    assert not any(c.isdigit() for c in str(excinfo.value))


def test_phone_number_rejects_a_non_canonical_value_built_directly() -> None:
    with pytest.raises(InvalidPhoneNumber):
        PhoneNumber("5491123456789")  # missing the leading +


def test_phone_number_rejects_a_54_value_that_is_not_549_plus_ten_digits() -> None:
    with pytest.raises(InvalidPhoneNumber):
        PhoneNumber("+5411234567890")


def test_phone_number_digits_drops_the_plus() -> None:
    assert PhoneNumber.of("11 2345-6789").digits == "5491123456789"


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
        phone=PhoneNumber.of("11 2345-6789"),
        id=customer_id,
    )


def _zoe(customer_id: int | None = None) -> Customer:
    return Customer(
        name=CustomerName.of("Zoe"),
        phone=PhoneNumber.of("11 9876-5432"),
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
    dashed = Customer(name=CustomerName.of("Jo-Jo"), phone=PhoneNumber.of("11 1111-1111"))

    assert dashed.matches("-")


# -- Customer.sort_key -----------------------------------------------------------------


def test_sort_key_orders_by_folded_name() -> None:
    customers = [_zoe(), _alvaro()]

    customers.sort(key=lambda c: c.sort_key)

    assert [c.name.value for c in customers] == ["Álvaro Núñez", "Zoe"]


def test_sort_key_breaks_ties_between_equal_names_by_id() -> None:
    first = Customer(name=CustomerName.of("Zoe"), phone=PhoneNumber.of("11 1111-1111"), id=2)
    second = Customer(name=CustomerName.of("Zoe"), phone=PhoneNumber.of("11 2222-2222"), id=1)

    ordered = sorted([first, second], key=lambda c: c.sort_key)

    assert [c.phone.value for c in ordered] == [second.phone.value, first.phone.value]
