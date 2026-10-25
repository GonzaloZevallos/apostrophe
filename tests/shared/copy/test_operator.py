import inspect
from pathlib import Path

import pytest

from app.settings import Settings
from app.shared.copy import MissingOperatorKey, operator_translator
from app.shared.language import ENGLISH, TEST_LOCALE, Language

FIXTURE_LOCALES = Path(__file__).resolve().parents[2] / "fixtures" / "locales"
GERMAN = Language("de")


def test_the_operator_language_speaks_when_nothing_is_forced() -> None:
    text = operator_translator(
        locales_dir=FIXTURE_LOCALES, operator_language=GERMAN, forced_language=None
    )

    assert text("fixture.greeting") == "Hallo"


def test_the_forced_language_wins_over_the_operator_language() -> None:
    text = operator_translator(
        locales_dir=FIXTURE_LOCALES, operator_language=GERMAN, forced_language=TEST_LOCALE
    )

    assert text("fixture.greeting") == "⟦Ĥèłłö·~⟧"


def test_named_placeholders_are_filled_from_the_data() -> None:
    text = operator_translator(
        locales_dir=FIXTURE_LOCALES, operator_language=ENGLISH, forced_language=None
    )

    assert text("fixture.braces", x="mundo") == "Hello mundo"


def test_a_key_no_catalog_holds_raises_and_names_only_the_key() -> None:
    text = operator_translator(
        locales_dir=FIXTURE_LOCALES, operator_language=ENGLISH, forced_language=None
    )

    with pytest.raises(MissingOperatorKey) as caught:
        text("operator.nowhere.nothing")

    assert caught.value.key == "operator.nowhere.nothing"


def test_the_translator_takes_exactly_the_locales_the_operator_and_the_forced_language() -> None:
    parameters = inspect.signature(operator_translator).parameters

    assert list(parameters) == ["locales_dir", "operator_language", "forced_language"]
    assert all(p.kind is inspect.Parameter.KEYWORD_ONLY for p in parameters.values())


def test_settings_forward_their_three_fields(tmp_path: Path) -> None:
    settings = Settings(secret_key="k", forced_language=TEST_LOCALE)

    assert settings.operator_translator()("operator.accounts.no_user").startswith("⟦")
