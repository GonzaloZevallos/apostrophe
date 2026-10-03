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

# Unicode 15.1 emoji-data.txt: every BMP code point with Emoji=Yes that this product
# recognises as an emoji base, split by Emoji_Presentation. TRADE MARK SIGN (U+2122),
# COPYRIGHT SIGN (U+00A9) and BLACK RIGHT-POINTING TRIANGLE (U+25B6) are deliberately
# left out of both sets: this product never treats them as emoji, with or without VS16.
# Emoji_Presentation=Yes: renders as an emoji by default, VS16 optional.
_BMP_PRESENTATION_YES: frozenset[int] = frozenset(
    {
        0x231A,
        0x231B,  # WATCH, HOURGLASS
        0x23E9,
        0x23EA,
        0x23EB,
        0x23EC,  # FAST FORWARD, REWIND, FAST UP, FAST DOWN BUTTON
        0x23F0,
        0x23F3,  # ALARM CLOCK, HOURGLASS DONE
        0x25FD,
        0x25FE,  # WHITE/BLACK MEDIUM-SMALL SQUARE
        0x2614,
        0x2615,  # UMBRELLA WITH RAIN DROPS, HOT BEVERAGE
        0x2648,
        0x2649,
        0x264A,
        0x264B,
        0x264C,
        0x264D,
        0x264E,
        0x264F,
        0x2650,
        0x2651,
        0x2652,
        0x2653,  # the 12 zodiac signs
        0x267F,  # WHEELCHAIR SYMBOL
        0x2693,  # ANCHOR
        0x26A1,  # HIGH VOLTAGE
        0x26AA,
        0x26AB,  # WHITE/BLACK CIRCLE
        0x26BD,
        0x26BE,  # SOCCER BALL, BASEBALL
        0x26C4,
        0x26C5,  # SNOWMAN WITHOUT SNOW, SUN BEHIND CLOUD
        0x26CE,  # OPHIUCHUS
        0x26D4,  # NO ENTRY
        0x26EA,  # CHURCH
        0x26F2,
        0x26F3,  # FOUNTAIN, FLAG IN HOLE
        0x26F5,  # SAILBOAT
        0x26FA,  # TENT
        0x26FD,  # FUEL PUMP
        0x2705,  # CHECK MARK BUTTON
        0x270A,
        0x270B,  # RAISED FIST, RAISED HAND
        0x2728,  # SPARKLES
        0x274C,  # CROSS MARK
        0x274E,  # NEGATIVE SQUARED CROSS MARK
        0x2753,  # QUESTION MARK ORNAMENT
        0x2757,  # HEAVY EXCLAMATION MARK
        0x2795,
        0x2796,
        0x2797,  # PLUS, MINUS, DIVIDE
        0x27B0,  # CURLY LOOP
        0x27BF,  # DOUBLE CURLY LOOP
        0x2B1B,
        0x2B1C,  # BLACK/WHITE LARGE SQUARE
        0x2B50,  # STAR
        0x2B55,  # HEAVY LARGE CIRCLE
    }
)
# Emoji_Presentation=No: text-default, needs VS16 to be accepted.
_BMP_PRESENTATION_NO: frozenset[int] = frozenset(
    {
        0x00AE,  # REGISTERED SIGN
        0x203C,  # DOUBLE EXCLAMATION MARK
        0x2049,  # EXCLAMATION QUESTION MARK
        0x2139,  # INFORMATION SOURCE
        0x2194,
        0x2195,
        0x2196,
        0x2197,
        0x2198,
        0x2199,  # the six double-headed arrows
        0x21A9,
        0x21AA,  # LEFTWARDS/RIGHTWARDS ARROW WITH HOOK
        0x2328,  # KEYBOARD
        0x23CF,  # EJECT SYMBOL
        0x23ED,
        0x23EE,
        0x23EF,  # NEXT/PREVIOUS TRACK, PLAY OR PAUSE
        0x23F1,
        0x23F2,  # STOPWATCH, TIMER CLOCK
        0x23F8,
        0x23F9,
        0x23FA,  # PAUSE, STOP, RECORD
        0x24C2,  # CIRCLED LATIN CAPITAL LETTER M
        0x25AA,
        0x25AB,  # BLACK/WHITE SMALL SQUARE
        0x25C0,  # BLACK LEFT-POINTING TRIANGLE
        0x25FB,
        0x25FC,  # WHITE/BLACK MEDIUM SQUARE
        0x2600,
        0x2601,
        0x2602,
        0x2603,
        0x2604,  # SUN, CLOUD, UMBRELLA, SNOWMAN, COMET
        0x260E,  # BLACK TELEPHONE
        0x2611,  # BALLOT BOX WITH CHECK
        0x2618,  # SHAMROCK
        0x261D,  # WHITE UP POINTING INDEX
        0x2620,  # SKULL AND CROSSBONES
        0x2622,
        0x2623,  # RADIOACTIVE, BIOHAZARD
        0x2626,  # ORTHODOX CROSS
        0x262A,  # STAR AND CRESCENT
        0x262E,
        0x262F,  # PEACE SYMBOL, YIN YANG
        0x2638,
        0x2639,
        0x263A,  # WHEEL OF DHARMA, FROWNING FACE, SMILING FACE
        0x2640,  # FEMALE SIGN
        0x2642,  # MALE SIGN
        0x265F,  # BLACK CHESS PAWN
        0x2660,  # BLACK SPADE SUIT
        0x2663,  # BLACK CLUB SUIT
        0x2665,
        0x2666,  # BLACK HEART/DIAMOND SUIT
        0x2668,  # HOT SPRINGS
        0x267B,  # BLACK UNIVERSAL RECYCLING SYMBOL
        0x267E,  # PERMANENT PAPER SIGN
        0x2692,  # HAMMER AND PICK
        0x2694,
        0x2695,
        0x2696,
        0x2697,  # CROSSED SWORDS, STAFF OF AESCULAPIUS, SCALES, ALEMBIC
        0x2699,  # GEAR
        0x269B,
        0x269C,  # ATOM SYMBOL, FLEUR-DE-LIS
        0x26A0,  # WARNING SIGN
        0x26A7,  # MALE WITH STROKE AND MALE AND FEMALE SIGN
        0x26B0,
        0x26B1,  # COFFIN, FUNERAL URN
        0x26C8,  # THUNDER CLOUD AND RAIN
        0x26CF,  # PICK
        0x26D1,  # HELMET WITH WHITE CROSS
        0x26D3,  # CHAINS
        0x26E9,  # SHINTO SHRINE
        0x26F0,
        0x26F1,  # MOUNTAIN, UMBRELLA ON GROUND
        0x26F4,  # FERRY
        0x26F7,
        0x26F8,
        0x26F9,  # SKIER, ICE SKATE, PERSON WITH BALL
        0x2702,  # BLACK SCISSORS
        0x2708,
        0x2709,  # AIRPLANE, ENVELOPE
        0x270C,
        0x270D,  # VICTORY HAND, WRITING HAND
        0x270F,  # PENCIL
        0x2712,  # BLACK NIB
        0x2714,  # HEAVY CHECK MARK
        0x2716,  # HEAVY MULTIPLICATION X
        0x271D,  # LATIN CROSS
        0x2721,  # STAR OF DAVID
        0x2733,
        0x2734,  # EIGHT SPOKED/POINTED ASTERISK
        0x2744,  # SNOWFLAKE
        0x2747,  # SPARKLE
        0x2754,
        0x2755,  # WHITE QUESTION/EXCLAMATION MARK ORNAMENT
        0x2763,
        0x2764,  # HEAVY HEART EXCLAMATION, HEAVY BLACK HEART
        0x27A1,  # BLACK RIGHTWARDS ARROW
        0x2934,
        0x2935,  # ARROW POINTING RIGHTWARDS THEN CURVING UP/DOWN
        0x2B05,
        0x2B06,
        0x2B07,  # LEFTWARDS/UPWARDS/DOWNWARDS BLACK ARROW
        0x3030,  # WAVY DASH
        0x303D,  # PART ALTERNATION MARK
        0x3297,  # CIRCLED IDEOGRAPH CONGRATULATION
        0x3299,  # CIRCLED IDEOGRAPH SECRET
    }
)
_BMP_BASES: dict[int, bool] = {
    **{cp: False for cp in _BMP_PRESENTATION_YES},
    **{cp: True for cp in _BMP_PRESENTATION_NO},
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
