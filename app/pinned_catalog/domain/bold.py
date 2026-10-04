"""Telegram's own bold (plan's invariant: only this module turns `**` into bold; no
code sends `parse_mode` or hand-built entities to Telegram).

`telegram_bold` pairs `**` left to right exactly as `web/src/screens/telegramPreview.ts`
does, so the plain text Telegram renders and the front's preview always agree
(ADR-0012, catalog; ADR-0013). Spans are offsets into the *plain* text (markers
removed), measured in UTF-16 code units, because that is how Telegram's own
`entities` are measured and how its 4096-character limit is counted.
"""

from __future__ import annotations

MESSAGE_LIMIT = 4096


def utf16_length(text: str) -> int:
    return len(text.encode("utf-16-le")) // 2


def telegram_bold(text: str) -> tuple[str, list[tuple[int, int]]]:
    """The plain text with every `**...**` pair's markers removed, plus the UTF-16
    `(offset, length)` span each pair's contents occupies in that plain text. A final
    unpaired `**` is left in the plain text exactly as typed (no span opens for it)."""
    parts = text.split("**")
    plain = parts[0]
    spans: list[tuple[int, int]] = []
    i = 1
    while i < len(parts):
        bold_text = parts[i]
        if i + 1 < len(parts):
            start = utf16_length(plain)
            length = utf16_length(bold_text)
            plain += bold_text
            if length > 0:
                spans.append((start, length))
            plain += parts[i + 1]
            i += 2
        else:
            plain += "**" + bold_text
            i += 1
    return plain, spans


def fits_in_one_message(plain: str) -> bool:
    """Telegram's 4096-character limit, checked on the plain text alone (spans mark
    bold ranges within it; they add no character of their own, so a caller never
    passes them here)."""
    return utf16_length(plain) <= MESSAGE_LIMIT
