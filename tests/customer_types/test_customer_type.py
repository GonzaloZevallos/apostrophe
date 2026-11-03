"""The customer type domain: name rule, closed icon set, entity (CONTEXT.md: Customer type)."""

import pytest

from app.customer_types.domain.customer_type import (
    DEFAULT_ICON,
    NAME_MAX_LENGTH,
    CustomerType,
    CustomerTypeIcon,
    CustomerTypeInUse,
    CustomerTypeName,
    IconUnknown,
    NameBlank,
    NameTooLong,
)


def test_a_name_is_trimmed_and_its_inner_spaces_collapsed() -> None:
    assert CustomerTypeName("  Mayorista   del  centro ").value == "Mayorista del centro"


def test_two_names_that_differ_only_in_case_or_spacing_share_a_key() -> None:
    assert CustomerTypeName(" VIP ").key == CustomerTypeName("vip").key
    assert CustomerTypeName("Muy   Fiel").key == CustomerTypeName("muy fiel").key
    assert CustomerTypeName("Regular").key != CustomerTypeName("Mayorista").key


@pytest.mark.parametrize("raw", ["", "   ", "\t\n"])
def test_a_blank_name_is_refused(raw: str) -> None:
    with pytest.raises(NameBlank) as refused:
        CustomerTypeName(raw)

    assert refused.value.code == "customer_type.name_blank"


def test_a_name_of_exactly_the_limit_is_accepted_and_one_more_is_refused() -> None:
    assert CustomerTypeName("a" * NAME_MAX_LENGTH).value == "a" * 40

    with pytest.raises(NameTooLong) as refused:
        CustomerTypeName("a" * (NAME_MAX_LENGTH + 1))

    assert refused.value.code == "customer_type.name_too_long"


def test_the_limit_counts_the_trimmed_name() -> None:
    assert CustomerTypeName(" " + "a" * 40 + "  ").value == "a" * 40


def test_the_icon_set_is_the_eight_neutral_keys_and_the_default_is_the_circle() -> None:
    assert [icon.value for icon in CustomerTypeIcon] == [
        "circle",
        "star",
        "heart",
        "diamond",
        "flag",
        "tag",
        "crown",
        "bell",
    ]
    assert DEFAULT_ICON is CustomerTypeIcon.CIRCLE


def test_an_icon_key_outside_the_set_is_refused() -> None:
    assert CustomerTypeIcon.of("star") is CustomerTypeIcon.STAR

    with pytest.raises(IconUnknown) as refused:
        CustomerTypeIcon.of("flame")

    assert refused.value.code == "customer_type.icon_unknown"


def test_a_new_type_takes_the_default_icon_and_is_not_the_vip_type() -> None:
    created = CustomerType(CustomerTypeName("Regular"))

    assert created.icon is DEFAULT_ICON
    assert created.is_vip is False


def test_a_type_with_customers_cannot_be_deleted_and_says_how_many() -> None:
    with pytest.raises(CustomerTypeInUse) as refused:
        CustomerType(CustomerTypeName("Regular")).check_deletable(3)

    assert refused.value.count == 3
    assert refused.value.code == "customer_type.in_use"


def test_an_empty_type_can_be_deleted_even_when_it_is_the_vip_type() -> None:
    CustomerType(CustomerTypeName("VIP"), CustomerTypeIcon.STAR, is_vip=True).check_deletable(0)
