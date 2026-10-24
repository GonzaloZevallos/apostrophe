"""What the app reads from its environment (app/settings.py), with no HTTP and no
database: the `Secure`-cookie decision, the trusted-proxy list and the two ways
`Settings` refuses to be built.
"""

from pathlib import Path

import pytest

from app.settings import (
    DEFAULT_LOCALES_DIR,
    IncompleteLanguage,
    InvalidSetting,
    MissingSetting,
    Settings,
)
from app.shared.language import ENGLISH, TEST_LOCALE, Language


def test_https_with_no_trusted_proxies_is_refused() -> None:
    with pytest.raises(MissingSetting) as excinfo:
        Settings(secret_key="k", public_url="https://example.com")

    assert "APOSTROPHE_TRUSTED_PROXIES" in str(excinfo.value)


def test_http_with_no_trusted_proxies_is_accepted() -> None:
    settings = Settings(secret_key="k", public_url="http://example.com")

    assert settings.trusted_proxies == ()


def test_https_with_trusted_proxies_is_accepted() -> None:
    settings = Settings(
        secret_key="k", public_url="https://example.com", trusted_proxies=("10.0.0.0/8",)
    )

    assert settings.secure_cookie is True


def test_an_unparsable_cidr_is_refused_and_the_message_names_the_setting_not_the_value() -> None:
    with pytest.raises(InvalidSetting) as excinfo:
        Settings(secret_key="k", trusted_proxies=("not-a-cidr",))

    message = str(excinfo.value)
    assert "APOSTROPHE_TRUSTED_PROXIES" in message
    assert "not-a-cidr" not in message


def test_secure_cookie_is_true_only_under_https() -> None:
    assert Settings(secret_key="k", public_url="http://example.com").secure_cookie is False
    assert (
        Settings(
            secret_key="k", public_url="https://example.com", trusted_proxies=("10.0.0.0/8",)
        ).secure_cookie
        is True
    )


def test_from_env_splits_and_strips_trusted_proxies_and_reads_the_auth_token(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("APOSTROPHE_SECRET_KEY", "k")
    monkeypatch.setenv("APOSTROPHE_TRUSTED_PROXIES", " 10.0.0.0/8 , 172.16.0.0/12,,")
    monkeypatch.setenv("APOSTROPHE_DATABASE_AUTH_TOKEN", "a-token")

    settings = Settings.from_env()

    assert settings.trusted_proxies == ("10.0.0.0/8", "172.16.0.0/12")
    assert settings.database_auth_token == "a-token"


def test_from_env_leaves_trusted_proxies_empty_and_the_auth_token_none_when_unset(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("APOSTROPHE_SECRET_KEY", "k")
    monkeypatch.delenv("APOSTROPHE_TRUSTED_PROXIES", raising=False)
    monkeypatch.delenv("APOSTROPHE_DATABASE_AUTH_TOKEN", raising=False)

    settings = Settings.from_env()

    assert settings.trusted_proxies == ()
    assert settings.database_auth_token is None


FIXTURE_LOCALES = Path(__file__).parent / "fixtures" / "locales"
GERMAN = Language("de")

_HEADER = (
    'msgid ""\nmsgstr ""\n"Language: de\\n"\n"Content-Type: text/plain; charset=UTF-8\\n"\n'
    '"Plural-Forms: nplurals=2; plural=(n != 1);\\n"\n\n'
)


def _locales_with_german(tmp_path: Path, german_entries: str) -> Path:
    english = (
        _HEADER.replace("de", "en") + 'msgid "a.one"\nmsgstr "One"\n\n'
        'msgid "a.two"\nmsgstr "Two"\n\n'
        'msgid "a.items"\nmsgid_plural "a.items_plural"\nmsgstr[0] "%(n)s thing"\n'
        'msgstr[1] "%(n)s things"\n'
    )
    for tag, text in (("en", english), ("de", _HEADER + german_entries)):
        directory = tmp_path / tag / "LC_MESSAGES"
        directory.mkdir(parents=True)
        (directory / "apostrophe.po").write_text(text, encoding="utf-8")
    return tmp_path


_GERMAN_COMPLETE = (
    'msgid "a.one"\nmsgstr "Eins"\n\nmsgid "a.two"\nmsgstr "Zwei"\n\n'
    'msgid "a.items"\nmsgid_plural "a.items_plural"\nmsgstr[0] "%(n)s Ding"\n'
    'msgstr[1] "%(n)s Dinge"\n'
)


def test_language_defaults_are_english_only_and_no_forced_language() -> None:
    settings = Settings(secret_key="k")

    assert settings.selectable_languages == (ENGLISH,)
    assert settings.operator_language == ENGLISH
    assert settings.forced_language is None
    assert settings.locales_dir == DEFAULT_LOCALES_DIR


def test_from_env_reads_the_forced_language_only_when_it_is_the_test_locale(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("APOSTROPHE_SECRET_KEY", "k")

    monkeypatch.delenv("APOSTROPHE_FORCED_LANGUAGE", raising=False)
    assert Settings.from_env().forced_language is None

    monkeypatch.setenv("APOSTROPHE_FORCED_LANGUAGE", "")
    assert Settings.from_env().forced_language is None

    monkeypatch.setenv("APOSTROPHE_FORCED_LANGUAGE", "en-XA")
    assert Settings.from_env().forced_language == TEST_LOCALE


def test_from_env_refuses_any_other_forced_language_without_naming_it(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("APOSTROPHE_SECRET_KEY", "k")
    monkeypatch.setenv("APOSTROPHE_FORCED_LANGUAGE", "fr-secret")

    with pytest.raises(InvalidSetting) as excinfo:
        Settings.from_env()

    assert "APOSTROPHE_FORCED_LANGUAGE" in str(excinfo.value)
    assert "fr-secret" not in str(excinfo.value)


def test_from_env_ignores_the_environment_for_selectable_and_operator_languages(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("APOSTROPHE_SECRET_KEY", "k")
    monkeypatch.setenv("APOSTROPHE_SELECTABLE_LANGUAGES", "de")
    monkeypatch.setenv("APOSTROPHE_OPERATOR_LANGUAGE", "de")

    settings = Settings.from_env()

    assert settings.selectable_languages == (ENGLISH,)
    assert settings.operator_language == ENGLISH


def test_a_forced_language_other_than_the_test_locale_is_refused() -> None:
    with pytest.raises(InvalidSetting) as excinfo:
        Settings(secret_key="k", forced_language=GERMAN)

    assert "APOSTROPHE_FORCED_LANGUAGE" in str(excinfo.value)


def test_a_forced_test_locale_is_accepted_with_the_real_directory() -> None:
    assert Settings(secret_key="k", forced_language=TEST_LOCALE).forced_language == TEST_LOCALE


def test_a_forced_test_locale_is_refused_when_the_directory_has_no_such_catalog(
    tmp_path: Path,
) -> None:
    locales = _locales_with_german(tmp_path, _GERMAN_COMPLETE)

    with pytest.raises(InvalidSetting) as excinfo:
        Settings(secret_key="k", locales_dir=locales, forced_language=TEST_LOCALE)

    assert "APOSTROPHE_FORCED_LANGUAGE" in str(excinfo.value)


def test_the_test_locale_is_refused_as_selectable_and_as_operator_language() -> None:
    with pytest.raises(InvalidSetting) as selectable:
        Settings(secret_key="k", selectable_languages=(ENGLISH, TEST_LOCALE))
    with pytest.raises(InvalidSetting) as operator:
        Settings(secret_key="k", operator_language=TEST_LOCALE)

    assert "selectable_languages" in str(selectable.value)
    assert "operator_language" in str(operator.value)


def test_a_complete_real_language_is_accepted_as_selectable_and_operator_language() -> None:
    settings = Settings(
        secret_key="k",
        locales_dir=FIXTURE_LOCALES,
        selectable_languages=(ENGLISH, GERMAN),
        operator_language=GERMAN,
    )

    assert settings.selectable_languages == (ENGLISH, GERMAN)


def test_a_complete_german_in_a_temporary_directory_is_accepted(tmp_path: Path) -> None:
    locales = _locales_with_german(tmp_path, _GERMAN_COMPLETE)

    Settings(secret_key="k", locales_dir=locales, selectable_languages=(ENGLISH, GERMAN))


@pytest.mark.parametrize(
    ("german", "missing"),
    [
        ('msgid "a.one"\nmsgstr "Eins"\n', "a.two"),
        (
            _GERMAN_COMPLETE.replace('msgstr "Zwei"', '#, fuzzy\nmsgstr "Zwei"'),
            "a.two",
        ),
        (_GERMAN_COMPLETE.replace('msgstr[1] "%(n)s Dinge"', 'msgstr[1] ""'), "a.items"),
    ],
    ids=["absent", "fuzzy", "empty-plural-form"],
)
def test_an_incomplete_selectable_language_is_refused_naming_the_tag_and_the_key(
    tmp_path: Path, german: str, missing: str
) -> None:
    locales = _locales_with_german(tmp_path, german)

    with pytest.raises(IncompleteLanguage) as excinfo:
        Settings(secret_key="k", locales_dir=locales, selectable_languages=(ENGLISH, GERMAN))

    assert "de" in str(excinfo.value)
    assert missing in str(excinfo.value)


def test_an_incomplete_operator_language_is_refused(tmp_path: Path) -> None:
    locales = _locales_with_german(tmp_path, 'msgid "a.one"\nmsgstr "Eins"\n')

    with pytest.raises(IncompleteLanguage):
        Settings(secret_key="k", locales_dir=locales, operator_language=GERMAN)


def test_the_refusal_names_only_the_first_five_missing_keys(tmp_path: Path) -> None:
    locales = _locales_with_german(tmp_path, "")
    english = locales / "en" / "LC_MESSAGES" / "apostrophe.po"
    extra = "".join(f'msgid "k.{n}"\nmsgstr "v{n}"\n\n' for n in range(8))
    english.write_text(english.read_text(encoding="utf-8") + extra, encoding="utf-8")

    with pytest.raises(IncompleteLanguage) as excinfo:
        Settings(secret_key="k", locales_dir=locales, operator_language=GERMAN)

    message = str(excinfo.value)
    assert "k.1" in message
    assert "k.7" not in message
