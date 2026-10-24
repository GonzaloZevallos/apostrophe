"""Languages as values (docs/adr/0050). Standard library only: no translation library
reaches the domain, so this module knows tags, never texts."""

import re
from collections.abc import Collection
from dataclasses import dataclass
from typing import ClassVar

_TAG = re.compile(r"[a-z]{2,3}(-[A-Za-z0-9]{2,8})*")


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
