from pathlib import Path

from babel.support import Translations

from app.shared.copy.messages import mo_path
from app.shared.language import ENGLISH, InvalidLanguageTag, Language


class UnknownLanguage(Exception):
    """The locales directory has no compiled catalog for this language."""

    def __init__(self, language: Language) -> None:
        super().__init__(f"No compiled catalog for language {language.tag}")


class MissingCatalogKey(Exception):
    """A catalog key that gettext answers with the key itself. Names the key and nothing
    else, so no message id ever reaches a catalog line or a default."""

    def __init__(self, key: str) -> None:
        super().__init__(f"No catalog text for key {key}")
        self.key = key


def required_text(translations: Translations, key: str) -> str:
    """`key`'s text, or `MissingCatalogKey` when gettext answers the key itself."""
    text = str(translations.gettext(key))
    if text == key:
        raise MissingCatalogKey(key)
    return text


class CopyCatalog:
    """Compiled gettext catalogs under `<locales_dir>/<tag>/LC_MESSAGES/apostrophe.mo`.

    English is the fallback: a key a language lacks comes back as English."""

    def __init__(self, locales_dir: Path) -> None:
        self._locales_dir = locales_dir

    def languages(self) -> frozenset[Language]:
        found: set[Language] = set()
        if not self._locales_dir.is_dir():
            return frozenset()
        for directory in self._locales_dir.iterdir():
            if mo_path(self._locales_dir, directory.name).is_file():
                try:
                    found.add(Language(directory.name))
                except InvalidLanguageTag:
                    continue
        return frozenset(found)

    def translations(self, language: Language) -> Translations:
        translations = self._load(language)
        if language != ENGLISH and ENGLISH in self.languages():
            translations.add_fallback(self._load(ENGLISH))
        return translations

    def translations_or_english(self, language: Language) -> Translations:
        """`translations`, except that a language with no compiled catalog gets English's:
        the one place that decides such a language renders English (the gettext fallback
        of docs/language.md, applied to every key at once)."""
        if language not in self.languages():
            return self.translations(ENGLISH)
        return self.translations(language)

    def _load(self, language: Language) -> Translations:
        path = mo_path(self._locales_dir, language.tag)
        if not path.is_file():
            raise UnknownLanguage(language)
        with path.open("rb") as handle:
            return Translations(fp=handle)
