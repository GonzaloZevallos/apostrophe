"""The shared name rule (`name_matches`, `search_order_key`) and how `Customer.matches`
uses it, with no infrastructure."""

from __future__ import annotations

import pytest

from app.customers.domain.customer import Customer, CustomerName, PhoneNumber
from app.shared.names import name_matches, search_order_key
from app.shared.phone_country import PhoneCountry

COMBINING_ACUTE = "́"


def _customer(name: str, phone: str | None = "11 5555-1234") -> Customer:
    return Customer(
        name=CustomerName.of(name),
        phone=None if phone is None else PhoneNumber.of(phone, PhoneCountry.AR),
    )


@pytest.mark.parametrize(
    ("name", "phone", "query", "expected"),
    [
        ("José", None, "jose", True),
        ("José", "11 5555-1234", "jose", True),
        ("Maria Fernanda", None, "ria fer", True),
        ("Maria Fernanda", None, "nanda", True),
        ("Zoe", "11 5555-1234", "011 5555", True),
        ("Zoe", "11 5555-1234", "5555", True),
        ("Zoe", "11 5555-1234", "(0)", False),
        ("Zoe", "11 5555-1234", "0", False),
        ("Zoe", None, "5555", False),
        ("Zoe", None, "zo", True),
        ("Zoe", "11 5555-1234", "1 3 4", False),
        ("Zoe", "11 5555-1234", "1 5555 1234 9", False),
        ("José", "11 5555-1234", COMBINING_ACUTE, False),
        ("José", None, COMBINING_ACUTE, False),
    ],
)
def test_customer_matches_table(name: str, phone: str | None, query: str, expected: bool) -> None:
    assert _customer(name, phone).matches(query) is expected


@pytest.mark.parametrize(
    ("name", "query", "expected"),
    [
        ("José", "jose", True),
        ("Maria Fernanda", "ria  fer", True),
        ("José", "", False),
        ("José", "   ", False),
        ("José", COMBINING_ACUTE, False),
        ("José", "Pedro", False),
    ],
)
def test_name_matches_table(name: str, query: str, expected: bool) -> None:
    assert name_matches(name, query) is expected


def test_search_order_key_puts_names_that_start_with_the_query_first() -> None:
    names = {1: "Ana Maria", 2: "Maria", 3: "Álvaro Maria", 4: "Marta"}

    ordered = sorted(names, key=lambda i: search_order_key(names[i], "mar", i))

    assert ordered == [2, 4, 3, 1]


def test_search_order_key_breaks_ties_by_folded_name_then_id() -> None:
    names = {5: "Zoe", 3: "ZOE", 4: "Álvaro"}

    ordered = sorted(names, key=lambda i: search_order_key(names[i], "", i))

    assert ordered == [4, 3, 5]
