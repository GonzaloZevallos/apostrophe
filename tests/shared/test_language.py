import pytest

from app.shared.language import (
    ENGLISH,
    TEST_LOCALE,
    BusinessLanguage,
    InvalidLanguageTag,
    Language,
    LanguageNotSelectable,
    shown_language,
)

GERMAN = Language("de")


@pytest.mark.parametrize("tag", ["en", "de", "en-XA", "pt-BR", "zh-Hant", "es-419"])
def test_a_well_formed_tag_is_a_language(tag: str) -> None:
    assert Language(tag).tag == tag


@pytest.mark.parametrize(
    "tag",
    [
        "",
        "EN",
        "en_US",
        "e",
        "english",
        "en-",
        "-en",
        "en--XA",
        "en-xa!",
        " en",
        "de\n",
        "en-xa",
        "de-at",
        "zh-hant",
        "en-Xa",
    ],
)
def test_a_malformed_tag_is_refused(tag: str) -> None:
    with pytest.raises(InvalidLanguageTag):
        Language(tag)


def test_an_invalid_tag_error_is_a_value_error_that_does_not_echo_the_tag() -> None:
    with pytest.raises(ValueError) as refused:
        Language("not a tag")

    assert "not a tag" not in str(refused.value)


def test_the_named_constants_hold_their_tags() -> None:
    assert (ENGLISH.tag, TEST_LOCALE.tag) == ("en", "en-XA")


def test_a_language_is_a_value() -> None:
    assert Language("de") == GERMAN
    assert hash(Language("de")) == hash(GERMAN)


def test_a_selectable_tag_becomes_a_business_language() -> None:
    assert BusinessLanguage.parse("en", [ENGLISH]).language == ENGLISH


def test_a_tag_outside_the_selectable_list_is_refused_with_its_code() -> None:
    with pytest.raises(LanguageNotSelectable) as refused:
        BusinessLanguage.parse("de", [ENGLISH])

    assert refused.value.code == "business.language_not_selectable"


def test_the_test_locale_is_refused_even_when_wrongly_listed_as_selectable() -> None:
    with pytest.raises(LanguageNotSelectable):
        BusinessLanguage.parse("en-XA", [ENGLISH, TEST_LOCALE])


def test_a_non_canonical_test_locale_is_refused_as_not_selectable() -> None:
    with pytest.raises(LanguageNotSelectable) as refused:
        BusinessLanguage.parse("en-xa", [ENGLISH, TEST_LOCALE])

    assert refused.value.code == "business.language_not_selectable"


def test_a_malformed_tag_is_refused_as_not_selectable() -> None:
    with pytest.raises(LanguageNotSelectable) as refused:
        BusinessLanguage.parse("???", [ENGLISH])

    assert refused.value.code == "business.language_not_selectable"


def test_the_refusal_names_the_rule_never_the_tag() -> None:
    with pytest.raises(LanguageNotSelectable) as refused:
        BusinessLanguage.parse("xx-secret", [ENGLISH])

    assert "xx-secret" not in str(refused.value)


def test_the_forced_language_overrides_the_stored_one_when_set() -> None:
    assert shown_language(BusinessLanguage(Language("de")), TEST_LOCALE) == TEST_LOCALE


def test_the_stored_language_is_shown_when_nothing_is_forced() -> None:
    assert shown_language(BusinessLanguage(Language("de")), None) == Language("de")
