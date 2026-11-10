"""The one table of Phone countries (docs/adr/0082): its shape, and the lookup refusing a
code that is not listed."""

import pytest

from app.shared.phone_country import RULES, PhoneCountry, PhoneCountryRule, UnknownPhoneCountry


def test_the_countries_are_listed_in_settings_order() -> None:
    assert [country.value for country in PhoneCountry] == [
        "AR",
        "UY",
        "CL",
        "PY",
        "BR",
        "MX",
        "ES",
        "US",
    ]


def test_every_country_has_a_rule() -> None:
    assert set(RULES) == set(PhoneCountry)


def test_each_calling_code_appears_once() -> None:
    codes = [country.rule.calling_code for country in PhoneCountry]
    assert len(codes) == len(set(codes))


def test_no_calling_code_is_a_prefix_of_another() -> None:
    codes = [country.rule.calling_code for country in PhoneCountry]
    for code in codes:
        for other in codes:
            assert code == other or not other.startswith(code), (code, other)


def test_no_listed_code_is_a_prefix_of_44() -> None:
    # "+44" is the sample of a code that is not listed: it must stay outside every rule.
    for country in PhoneCountry:
        assert not "44".startswith(country.rule.calling_code)


def test_every_length_set_is_non_empty() -> None:
    for country in PhoneCountry:
        assert country.rule.national_lengths


def test_the_values_of_the_table() -> None:
    assert {
        c.value: (c.rule.calling_code, sorted(c.rule.national_lengths)) for c in PhoneCountry
    } == {
        "AR": ("54", [10]),
        "UY": ("598", [8]),
        "CL": ("56", [9]),
        "PY": ("595", [8, 9]),
        "BR": ("55", [10, 11]),
        "MX": ("52", [10]),
        "ES": ("34", [9]),
        "US": ("1", [10]),
    }
    assert PhoneCountry.AR.rule.mobile_nine == "9"
    assert PhoneCountry.AR.rule.local_mobile_fifteen == "15"
    assert PhoneCountry.US.rule.trunk_prefix == "1"
    assert PhoneCountry.CL.rule.trunk_prefix is None


def test_the_international_lengths_add_the_calling_code() -> None:
    assert PhoneCountry.PY.rule.international_lengths == frozenset({11, 12})
    assert PhoneCountry.US.rule.international_lengths == frozenset({11})


def test_a_listed_code_parses_and_an_unknown_one_is_refused() -> None:
    assert PhoneCountry.parse("UY") is PhoneCountry.UY
    for bad in ("", "uy", "XX", "ARG", " AR", "54"):
        with pytest.raises(UnknownPhoneCountry) as refused:
            PhoneCountry.parse(bad)
        assert refused.value.code == "business.phone_country_unknown"
        assert bad not in str(refused.value) or bad == ""


def test_a_rule_with_no_national_length_is_refused() -> None:
    with pytest.raises(ValueError, match="at least one national length"):
        PhoneCountryRule("99", frozenset())
