"""A name's initials (docs/product/initials.md): one rule, written here and in
`web/src/format/initials.ts`, held equal on every row of the shared fixture
`web/src/format/initials.cases.json`.

Standard library only (CODING_STANDARDS section 1). The cluster segmenter is an
approximation of the browser's `Intl.Segmenter`: Prepend characters, Indic conjuncts and a
ZWJ between ordinary letters are known gaps, and they give a less exact split, never an
empty or overlong cluster.
"""

from __future__ import annotations

import unicodedata

_CLUSTER_LIMIT = 16

# Exactly JS `\s`; `str.split`, `str.strip` and `str.isspace` use a different set (they also
# take U+001C-U+001F and U+0085), so a name is never split by them.
_WHITESPACE = frozenset(
    {
        "\t",
        "\n",
        "\x0b",
        "\x0c",
        "\r",
        " ",
        "\xa0",
        "\u1680",
        *(chr(code) for code in range(0x2000, 0x200B)),
        "\u2028",
        "\u2029",
        "\u202f",
        "\u205f",
        "\u3000",
        "\ufeff",
    }
)

_ZWJ = "\u200d"
_ALWAYS_JOINING = frozenset({"\u200c"})
_JOINING_CATEGORIES = frozenset({"Mn", "Mc", "Me"})


def _joins_previous(char: str) -> bool:
    code = ord(char)
    return (
        unicodedata.category(char) in _JOINING_CATEGORIES
        or char in _ALWAYS_JOINING
        or 0xFE00 <= code <= 0xFE0F
        or 0x1F3FB <= code <= 0x1F3FF
        or 0xE0020 <= code <= 0xE007F
    )


def _is_regional_indicator(char: str) -> bool:
    return 0x1F1E6 <= ord(char) <= 0x1F1FF


def _hangul_type(char: str) -> str | None:
    """L, V, T, LV or LVT by code-point ranges; `None` for any other character."""
    code = ord(char)
    if 0x1100 <= code <= 0x115F or 0xA960 <= code <= 0xA97C:
        return "L"
    if 0x1160 <= code <= 0x11A7 or 0xD7B0 <= code <= 0xD7C6:
        return "V"
    if 0x11A8 <= code <= 0x11FF or 0xD7CB <= code <= 0xD7FB:
        return "T"
    if 0xAC00 <= code <= 0xD7A3:
        return "LV" if (code - 0xAC00) % 28 == 0 else "LVT"
    return None


_HANGUL_JOINS = frozenset(
    {
        *(("L", after) for after in ("L", "V", "LV", "LVT")),
        *((before, after) for before in ("LV", "V") for after in ("V", "T")),
        *((before, "T") for before in ("LVT", "T")),
    }
)


def _clusters(word: str) -> list[str]:
    clusters: list[str] = []
    pulls_next = False
    for char in word:
        if not clusters:
            clusters.append(char)
        elif pulls_next or _joins_previous(char) or char == _ZWJ:
            clusters[-1] += char
        elif _is_regional_indicator(char) and _is_single_regional_indicator(clusters[-1]):
            clusters[-1] += char
        elif _hangul_joins(clusters[-1][-1], char):
            clusters[-1] += char
        else:
            clusters.append(char)
        pulls_next = char == _ZWJ
    return clusters


def _is_single_regional_indicator(cluster: str) -> bool:
    return len(cluster) == 1 and _is_regional_indicator(cluster)


def _hangul_joins(before: str, after: str) -> bool:
    before_type = _hangul_type(before)
    after_type = _hangul_type(after)
    return (
        before_type is not None
        and after_type is not None
        and (before_type, after_type) in _HANGUL_JOINS
    )


def _words(name: str) -> list[str]:
    words: list[str] = []
    current: list[str] = []
    for char in name:
        if char in _WHITESPACE:
            if current:
                words.append("".join(current))
                current = []
        else:
            current.append(char)
    if current:
        words.append("".join(current))
    return words


def _shown(cluster: str) -> str:
    """Upper-cased first, then cut: `ß` becomes `SS` before the cut, as on the front."""
    return cluster.upper()[:_CLUSTER_LIMIT]


def initials_of(name: str) -> str:
    """Two or more words give the first cluster of each of the first two; one word gives its
    first two clusters; no word gives `''`."""
    words = _words(name)
    if not words:
        return ""
    if len(words) == 1:
        kept = _clusters(words[0])[:2]
    else:
        kept = [_clusters(words[0])[0], _clusters(words[1])[0]]
    return "".join(_shown(cluster) for cluster in kept)
