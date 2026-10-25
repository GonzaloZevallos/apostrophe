import pytest

from app.shared.copy.negotiation import pre_sign_in_language
from app.shared.language import ENGLISH, TEST_LOCALE, Language

GERMAN = Language("de")
SELECTABLE = (ENGLISH, GERMAN)

ENGLISH_ROWS: list[str | None] = [
    None,
    "",
    "*",
    "EN-gb",
    "en_US",
    "de_DE, de;q=0.5",
    "xx!!, de",
    "de;level=1",
    "de;q=1.5",
    "de;q=abc",
    "en;;q=1",
    "de;q=0",
    "de;q=0.5, en;q=0.9",
    "de\x00",
    "de\x7f",
    "deé",
    ("fr, " * 300) + "de",
    "x" * 100_000,
    "en-XA",
    "en-xa, de;q=0.1",
    "de;q=0.1234",
    "de;q=",
]


@pytest.mark.parametrize("header", ENGLISH_ROWS)
def test_a_header_that_is_absent_malformed_or_unmatched_gives_english(header: str | None) -> None:
    assert pre_sign_in_language(header, None, SELECTABLE) == ENGLISH
    assert pre_sign_in_language(header, None, SELECTABLE) == pre_sign_in_language(
        None, None, SELECTABLE
    )


@pytest.mark.parametrize(
    "header",
    [
        "de",
        "de-AT",
        "DE-at",
        "fr, de;q=0.8",
        "de,",
        ", de",
        "de, *",
        "de;q=1",
        "de ; q=0.5",
        " de ",
    ],
)
def test_a_header_that_names_a_selectable_language_gives_it(header: str) -> None:
    assert pre_sign_in_language(header, None, SELECTABLE) == GERMAN


def test_a_header_over_the_limit_gives_english_even_when_it_ends_in_a_language() -> None:
    header = ", ".join(["fr"] * 400) + ", de"
    assert len(header) > 1024

    assert pre_sign_in_language(header, None, SELECTABLE) == ENGLISH


def test_the_q_order_decides_between_two_selectable_languages() -> None:
    assert pre_sign_in_language("en;q=0.2, de;q=0.9", None, SELECTABLE) == GERMAN


def test_a_language_that_is_not_selectable_is_never_given() -> None:
    assert pre_sign_in_language("de", None, (ENGLISH,)) == ENGLISH


@pytest.mark.parametrize("header", [None, "", "de", "en-XA", "xx!!", "x" * 100_000])
def test_a_forced_language_wins_over_any_header(header: str | None) -> None:
    assert pre_sign_in_language(header, TEST_LOCALE, SELECTABLE) == TEST_LOCALE
