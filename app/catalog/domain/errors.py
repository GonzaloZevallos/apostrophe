"""Catalog's own domain errors (CONTEXT.md: Catalog; CODING_STANDARDS section 9): each
carries a fixed message, built with no argument, so what a seller typed can never slip
into it by accident. Each carries its own `code`, never one inherited from a shared
base, so `tests/test_refusal_codes.py` finds each refusal exactly once.
"""

from __future__ import annotations

from typing import ClassVar


class CatalogRuleBroken(ValueError):
    """A catalog rule was broken; each subclass names which one and carries its own
    fixed message, never the header, footer, aroma, emoji or name that broke it."""


class EmojiInvalid(CatalogRuleBroken):
    code: ClassVar[str] = "catalog.emoji_invalid"

    def __init__(self) -> None:
        super().__init__("an emoji must be exactly one emoji")


class IndicaShareInvalid(CatalogRuleBroken):
    code: ClassVar[str] = "catalog.indica_share_invalid"

    def __init__(self) -> None:
        super().__init__("an indica share is a whole percent from 0 to 100")


class AromaTooLong(CatalogRuleBroken):
    code: ClassVar[str] = "catalog.aroma_too_long"

    def __init__(self) -> None:
        super().__init__("an aroma has at most 200 characters")


class HeaderTooLong(CatalogRuleBroken):
    code: ClassVar[str] = "catalog.header_too_long"

    def __init__(self) -> None:
        super().__init__("a catalog header has at most 500 characters")


class FooterTooLong(CatalogRuleBroken):
    code: ClassVar[str] = "catalog.footer_too_long"

    def __init__(self) -> None:
        super().__init__("a catalog footer has at most 500 characters")
