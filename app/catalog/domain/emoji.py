"""The catalog's own emoji grammar (CONTEXT.md: Catalog attributes), standard library
only: no third-party emoji package. A `CatalogEmoji` holds exactly one emoji, the way a
customer would type it from a phone keyboard: a single base, a ZWJ sequence, a flag, a
keycap or a tag sequence, each optionally carrying VS16 and (for a plain base) one skin
tone modifier.

The two literal tables below are curated for this product, not exhaustive: a later
Unicode version may add code points that need an update here.
"""

from __future__ import annotations

from dataclasses import dataclass

from app.catalog.domain.errors import EmojiInvalid

VS16 = "️"
ZWJ = "‍"

# U+1F000-1FAFF: accepted wholesale as bases, unassigned code points included.
_WIDE_RANGE = range(0x1F000, 0x1FB00)
# The 26 flag letters: a base only in a pair (a flag), never alone.
_REGIONAL_INDICATOR = range(0x1F1E6, 0x1F200)
# A modifier only: never a base on its own.
_SKIN_TONE = range(0x1F3FB, 0x1F400)
# Unicode 15.1: the Enclosed Alphanumeric Supplement block, other than the regional
# indicators above, is Emoji_Presentation=No (needs VS16).
_ENCLOSED_ALPHANUMERIC_TEXT_DEFAULT = range(0x1F100, 0x1F1E6)
# Unicode 15.1 emoji-data.txt: a small set of other U+1F000-1FAFF code points that are
# also Emoji_Presentation=No, e.g. THERMOMETER (U+1F321) and DOVE OF PEACE (U+1F54A).
_TEXT_DEFAULT_WIDE_SINGLES = frozenset({0x1F321, 0x1F54A})

# Unicode 15.1 emoji-data.txt: BMP code points this product recognises as emoji bases.
# True means Emoji_Presentation=No (VS16 required to be accepted); False means Yes (VS16
# optional). TRADE MARK SIGN (U+2122), COPYRIGHT SIGN (U+00A9) and BLACK RIGHT-POINTING
# TRIANGLE (U+25B6) are deliberately left out: this product never treats them as emoji,
# with or without VS16.
_BMP_BASES: dict[int, bool] = {
    0x2764: True,  # HEAVY BLACK HEART
    0x2763: True,  # HEAVY HEART EXCLAMATION MARK ORNAMENT
    0x2600: True,  # BLACK SUN WITH RAYS
    0x2602: True,  # UMBRELLA
    0x26A0: True,  # WARNING SIGN
    0x2708: True,  # AIRPLANE
    0x231A: False,  # WATCH
    0x231B: False,  # HOURGLASS
    0x2614: False,  # UMBRELLA WITH RAIN DROPS
    0x2615: False,  # HOT BEVERAGE
    0x270A: False,  # RAISED FIST
}

_KEYCAP_BASES = frozenset("0123456789#*")
_KEYCAP_COMBINING = "⃣"

_TAG_BASE = "\U0001f3f4"
_TAG_CHAR = range(0xE0020, 0xE007F)
_TAG_TERMINATOR = "\U000e007f"


def _base(code_point: int) -> tuple[bool, bool]:
    """`(is_base, needs_vs16)` for one code point used as a base."""
    if code_point in _WIDE_RANGE:
        if code_point in _REGIONAL_INDICATOR or code_point in _SKIN_TONE:
            return False, False
        if (
            code_point in _TEXT_DEFAULT_WIDE_SINGLES
            or code_point in _ENCLOSED_ALPHANUMERIC_TEXT_DEFAULT
        ):
            return True, True
        return True, False
    if code_point in _BMP_BASES:
        return True, _BMP_BASES[code_point]
    return False, False


def _is_base_unit(code_points: list[int]) -> bool:
    """A base, optionally followed by VS16 and optionally by one skin tone modifier,
    with nothing left over."""
    if not code_points:
        return False
    is_base, needs_vs16 = _base(code_points[0])
    if not is_base:
        return False
    index = 1
    has_vs16 = False
    if index < len(code_points) and code_points[index] == ord(VS16):
        has_vs16 = True
        index += 1
    if index < len(code_points) and code_points[index] in _SKIN_TONE:
        index += 1
    if index != len(code_points):
        return False
    return has_vs16 or not needs_vs16


def _is_flag(code_points: list[int]) -> bool:
    return len(code_points) == 2 and all(cp in _REGIONAL_INDICATOR for cp in code_points)


def _is_keycap(code_points: list[int]) -> bool:
    if len(code_points) == 2:
        base, combining = code_points
        return chr(base) in _KEYCAP_BASES and combining == ord(_KEYCAP_COMBINING)
    if len(code_points) == 3:
        base, vs16, combining = code_points
        return (
            chr(base) in _KEYCAP_BASES
            and vs16 == ord(VS16)
            and combining == ord(_KEYCAP_COMBINING)
        )
    return False


def _is_tag_sequence(code_points: list[int]) -> bool:
    if len(code_points) < 3:
        return False
    if code_points[0] != ord(_TAG_BASE) or code_points[-1] != ord(_TAG_TERMINATOR):
        return False
    return all(cp in _TAG_CHAR for cp in code_points[1:-1])


def _is_zwj_sequence(code_points: list[int]) -> bool:
    groups: list[list[int]] = [[]]
    for cp in code_points:
        if cp == ord(ZWJ):
            groups.append([])
        else:
            groups[-1].append(cp)
    if len(groups) < 2:
        return False
    return all(_is_base_unit(group) for group in groups)


def _is_single_emoji(value: str) -> bool:
    code_points = [ord(c) for c in value]
    if not code_points:
        return False
    if _is_tag_sequence(code_points):
        return True
    if _is_flag(code_points):
        return True
    if _is_keycap(code_points):
        return True
    if ord(ZWJ) in code_points:
        return _is_zwj_sequence(code_points)
    return _is_base_unit(code_points)


@dataclass(frozen=True)
class CatalogEmoji:
    value: str

    def __post_init__(self) -> None:
        if not _is_single_emoji(self.value):
            raise EmojiInvalid()

    @classmethod
    def of(cls, raw: str) -> CatalogEmoji:
        """Trims; a single bare BMP text-default base that is in the emoji set gets
        VS16 added (❤ becomes ❤️). That is the only normalisation: every
        other shape must already carry whatever VS16 its base needs."""
        candidate = raw.strip()
        if len(candidate) == 1 and _BMP_BASES.get(ord(candidate)) is True:
            candidate = candidate + VS16
        return cls(candidate)
