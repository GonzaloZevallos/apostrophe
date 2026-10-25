from pathlib import Path

from babel.support import Translations

from app.shared.copy.messages import mo_path
from app.shared.language import ENGLISH, InvalidLanguageTag, Language


class UnknownLanguage(Exception):
    """The locales directory has no compiled catalog for this language."""

    def __init__(self, language: Language) -> None:
        super().__init__(f"No compiled catalog for language {language.tag}")


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

    def _load(self, language: Language) -> Translations:
        path = mo_path(self._locales_dir, language.tag)
        if not path.is_file():
            raise UnknownLanguage(language)
        with path.open("rb") as handle:
            return Translations(fp=handle)
