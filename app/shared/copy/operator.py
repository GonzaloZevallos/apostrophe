"""The operator's translator (docs/adr/0050 and its amendment): the text of the commands the
operator runs -- never a business's language, never a request's.

It takes the three things that decide the language and nothing else: `invite-business.sh`
runs before any business exists, so there is no business, session or request to take.
"""

from __future__ import annotations

from pathlib import Path

from babel.support import Translations

from app.shared.copy.catalog import CopyCatalog
from app.shared.language import Language


class MissingOperatorKey(Exception):
    """No catalog, not even English, holds this key. Names the key and nothing else."""

    def __init__(self, key: str) -> None:
        super().__init__(f"No operator text for key {key}")
        self.key = key


class OperatorText:
    """`text(key, **data)`: the gettext of `key`, then its named `{placeholders}` filled
    from `data`. A `data` value is already text -- a count or a date is converted by the
    caller, so its format stays the caller's."""

    def __init__(self, translations: Translations) -> None:
        self._translations = translations
        self.rendered: set[str] = set()

    def __call__(self, key: str, **data: str) -> str:
        template = str(self._translations.gettext(key))
        if template == key:
            raise MissingOperatorKey(key)
        self.rendered.add(key)
        return template.format(**data)


def operator_translator(
    *, locales_dir: Path, operator_language: Language, forced_language: Language | None
) -> OperatorText:
    """The forced language when there is one, else the operator's; English is the
    fallback for a key the chosen language lacks."""
    language = forced_language if forced_language is not None else operator_language
    return OperatorText(CopyCatalog(locales_dir).translations(language))
