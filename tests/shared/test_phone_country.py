"""The one table of Phone countries (docs/adr/0082): its shape, and the lookup refusing a
code that is not listed."""

from typing import Any

import pytest

from app.customers.domain.customer import PhoneNumber
from app.shared.phone_country import (
    RULES,
    PhoneCountry,
    PhoneCountryRule,
    UnknownPhoneCountry,
    grouped,
    listed_countries,
)


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
        assert refused.value.code == "customer.phone_country_unknown"
        assert bad not in str(refused.value) or bad == ""


def test_a_rule_with_no_national_length_is_refused() -> None:
    with pytest.raises(ValueError, match="at least one national length"):
        PhoneCountryRule("99", frozenset(), groupings={}, example="1")


def _rule(
    lengths: frozenset[int] = frozenset({4}),
    groupings: dict[int, str] | None = None,
    example: str = "12 34",
) -> PhoneCountryRule:
    return PhoneCountryRule(
        "99",
        lengths,
        groupings={4: "## ##"} if groupings is None else groupings,
        example=example,
    )


def test_a_length_with_no_template_is_refused() -> None:
    with pytest.raises(ValueError, match="every national length needs a grouping"):
        _rule(lengths=frozenset({4, 5}))


def test_a_template_for_a_length_that_is_not_national_is_refused() -> None:
    with pytest.raises(ValueError, match="a grouping is for a national length"):
        _rule(groupings={4: "## ##", 5: "## ###"})


def test_a_template_whose_digit_count_is_not_its_length_is_refused() -> None:
    with pytest.raises(ValueError, match="a grouping must have one # per digit"):
        _rule(groupings={4: "## ###"})


@pytest.mark.parametrize("template", ["## .#", "##/##", "##(#)#", "##  1#", "##_##"])
def test_a_template_with_a_separator_other_than_space_and_dash_is_refused(template: str) -> None:
    with pytest.raises(ValueError, match="only a space and a dash may separate"):
        _rule(groupings={4: template})


def test_a_missing_example_is_refused() -> None:
    with pytest.raises(ValueError, match="a country needs an example"):
        _rule(example="")


def test_a_dash_and_a_space_are_accepted_as_separators() -> None:
    rule = _rule(lengths=frozenset({3}), groupings={3: "#-# #"})

    assert rule.groupings[3] == "#-# #"


@pytest.mark.parametrize("country", list(PhoneCountry))
def test_every_example_is_accepted_by_phone_number_of(country: PhoneCountry) -> None:
    PhoneNumber.of(country.rule.example, country)


def test_every_rule_is_hashable() -> None:
    assert len({hash(rule) for rule in RULES.values()}) > 0


def test_the_groupings_of_a_rule_are_read_only() -> None:
    groupings: Any = PhoneCountry.UY.rule.groupings

    with pytest.raises(TypeError):
        groupings[8] = "########"


def test_changing_the_dict_a_rule_was_built_from_does_not_change_the_rule() -> None:
    source = {4: "## ##"}
    rule = _rule(groupings=source)

    source[4] = "####"

    assert rule.groupings[4] == "## ##"


def test_the_table_holds_the_templates_and_examples() -> None:
    assert {c.value: (dict(c.rule.groupings), c.rule.example) for c in PhoneCountry} == {
        "AR": ({10: "## ####-####"}, "11 2345-6789"),
        "UY": ({8: "## ### ###"}, "099 123 456"),
        "CL": ({9: "# #### ####"}, "9 1234 5678"),
        "PY": ({9: "### ######", 8: "## ######"}, "0981 123 456"),
        "BR": ({11: "## #####-####", 10: "## ####-####"}, "(11) 91234-5678"),
        "MX": ({10: "## #### ####"}, "55 1234 5678"),
        "ES": ({9: "### ### ###"}, "612 34 56 78"),
        "US": ({10: "### ###-####"}, "(212) 555-0123"),
    }


def test_listed_countries_are_the_enum_in_settings_order() -> None:
    assert listed_countries() == tuple(PhoneCountry)


def test_grouped_refuses_digits_it_cannot_group() -> None:
    assert grouped("5411234567890") is None  # AR without the mobile 9
    assert grouped("541123456789") is None  # AR, 9 digits after the code
    assert grouped("5212345") is None  # MX, 5 digits
    assert grouped("59312345678") is None  # unlisted code


def test_grouped_groups_digits_it_can() -> None:
    assert grouped("5491123456789") == "+54 9 11 2345-6789"
    assert grouped("12125551234") == "+1 212 555-1234"
