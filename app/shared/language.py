"""Languages as values (docs/adr/0050). Standard library only: no translation library
reaches the domain, so this module knows tags, never texts."""

import re
from collections.abc import Collection
from dataclasses import dataclass
from typing import ClassVar

# Canonical BCP 47 case: language lowercase, script title case, region upper case or three
# digits, variants lowercase. One spelling per language, so `en-xa` is never a second
# value beside TEST_LOCALE.
_TAG = re.compile(
    r"[a-z]{2,3}(-[A-Z][a-z]{3})?(-([A-Z]{2}|\d{3}))?(-([a-z0-9]{5,8}|\d[a-z0-9]{3}))*"
)


class InvalidLanguageTag(ValueError):
    """A tag that is not a language tag in canonical case."""

    def __init__(self) -> None:
        super().__init__("A language tag is a lowercase language subtag plus optional subtags")


class LanguageNotSelectable(Exception):
    """A business cannot be set to this language (ADR-0050)."""

    code: ClassVar[str] = "business.language_not_selectable"

    def __init__(self) -> None:
        super().__init__("The language is not one a business can choose")


@dataclass(frozen=True)
class Language:
    """Any tag the copy module has, `en-XA` included."""

    tag: str

    def __post_init__(self) -> None:
        if _TAG.fullmatch(self.tag) is None:
            raise InvalidLanguageTag


ENGLISH = Language("en")
TEST_LOCALE = Language("en-XA")


@dataclass(frozen=True)
class BusinessLanguage:
    """A language a business can choose: selectable, and never the test locale."""

    language: Language

    @classmethod
    def parse(cls, tag: str, selectable: Collection[Language]) -> "BusinessLanguage":
        try:
            language = Language(tag)
        except InvalidLanguageTag:
            raise LanguageNotSelectable from None
        if language == TEST_LOCALE or language not in selectable:
            raise LanguageNotSelectable
        return cls(language)


def shown_language(stored: BusinessLanguage, forced: Language | None) -> Language:
    """The language screens are rendered in: the operator's forced one when set, else the
    business's own. The only place the forced language overrides stored data (ADR-0050);
    the stored value itself is never rewritten."""
    return forced if forced is not None else stored.language
