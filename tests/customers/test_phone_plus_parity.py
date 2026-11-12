"""The "+" is read the same on the server and on the device: `PhoneNumber.plus_digits`
with `listed_country_of` here, `shownCountry` in `web/src/phone/shownCountry.ts`, over the one
fixture `web/src/phone/plusCases.json`."""

import json
from pathlib import Path
from typing import Any

import pytest

from app.customers.domain.customer import PhoneNumber
from app.shared.phone_country import listed_country_of

CASES: list[dict[str, Any]] = json.loads(
    (Path(__file__).resolve().parents[2] / "web" / "src" / "phone" / "plusCases.json").read_text()
)


@pytest.mark.parametrize("case", CASES, ids=[case["text"] for case in CASES])
def test_the_server_reads_the_plus_as_the_front_does(case: dict[str, Any]) -> None:
    digits = PhoneNumber.plus_digits(case["text"])

    assert (digits is not None) is case["locked"]
    if digits is not None:
        country = listed_country_of(digits)
        assert (country.value if country else None) == case["country"]


@pytest.mark.parametrize(
    ("raw", "digits"),
    [
        ("+598 99-123.456", "59899123456"),
        ("(+54) 9 11", "54911"),
        ("+", ""),
        ("598", None),
        ("5+98", None),
        ("", None),
    ],
)
def test_plus_digits_removes_the_separators_after_a_leading_plus(
    raw: str, digits: str | None
) -> None:
    assert PhoneNumber.plus_digits(raw) == digits
