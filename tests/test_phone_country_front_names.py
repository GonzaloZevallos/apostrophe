"""The front names exactly the countries the server lets a business choose, in the same order.

`web/src/copy/readers/phoneCountryCodes.ts` lists the ISO codes the Phone country control draws
(a vitest next to it checks each has a name in the Copy module), and the control draws only those
codes (ADR-0082: a new country is one row in the server table). A country added to `PhoneCountry`
and missing there would vanish from Settings, so this fails.
"""

import re
from pathlib import Path

from app.shared.phone_country import PhoneCountry

CODES_FILE = (
    Path(__file__).resolve().parents[1]
    / "web"
    / "src"
    / "copy"
    / "readers"
    / "phoneCountryCodes.ts"
)


def _named_codes(source: str) -> list[str]:
    return re.findall(r"'([A-Z]{2})'", source)


def test_the_front_names_every_server_phone_country_in_the_server_order() -> None:
    source = CODES_FILE.read_text(encoding="utf-8")

    assert _named_codes(source) == [country.value for country in PhoneCountry]


def test_a_country_the_front_has_no_name_for_does_not_match_the_server_list() -> None:
    source = CODES_FILE.read_text(encoding="utf-8")
    without_us = source.replace("'US'", "")

    assert _named_codes(without_us) != [country.value for country in PhoneCountry]
