"""A variety's catalog attributes (CONTEXT.md: Catalog attributes, Hidden variety,
Indica share, Aroma): whether it is shown, its emoji, its indica share and its aroma.
`CatalogAttributes.default()` is the only place a variety without an attributes row
reads as shown with nothing filled in; nothing else writes that default.
"""

from __future__ import annotations

from dataclasses import dataclass

from app.catalog.domain.emoji import CatalogEmoji
from app.catalog.domain.errors import AromaTooLong, IndicaShareInvalid

AROMA_MAX_LENGTH = 200


@dataclass(frozen=True)
class IndicaShare:
    """Sativa is the rest (`100 - percent`); the text builder computes that, this
    value object only guards the whole percent itself."""

    percent: int

    def __post_init__(self) -> None:
        if not 0 <= self.percent <= 100:
            raise IndicaShareInvalid()


@dataclass(frozen=True)
class Aroma:
    """Already collapsed (every whitespace run, line breaks included, to one space)
    and trimmed, 1 to 200 code points. Build through `of`, never the constructor
    directly, so that invariant always holds."""

    text: str

    def __post_init__(self) -> None:
        if not self.text or self.text != " ".join(self.text.split()):
            raise ValueError(
                "an Aroma holds collapsed, trimmed, non-empty text; build it through Aroma.of"
            )
        if len(self.text) > AROMA_MAX_LENGTH:
            raise AromaTooLong()

    @classmethod
    def of(cls, raw: str) -> Aroma | None:
        collapsed = " ".join(raw.split())
        if not collapsed:
            return None
        return cls(collapsed)


@dataclass(frozen=True)
class CatalogAttributes:
    shown: bool
    emoji: CatalogEmoji | None
    indica_share: IndicaShare | None
    aroma: Aroma | None

    @classmethod
    def default(cls) -> CatalogAttributes:
        """The only place this default lives: shown, with nothing else filled in."""
        return cls(shown=True, emoji=None, indica_share=None, aroma=None)

    @classmethod
    def of(
        cls,
        shown: bool,
        emoji: str | None,
        indica_share: int | None,
        aroma: str | None,
    ) -> CatalogAttributes:
        return cls(
            shown=shown,
            emoji=CatalogEmoji.of(emoji) if emoji is not None else None,
            indica_share=IndicaShare(indica_share) if indica_share is not None else None,
            aroma=Aroma.of(aroma) if aroma is not None else None,
        )
