"""Whether what the operator typed names the business to remove (the plan's
invariant: the comparison is NFC, with no other folding).
"""

from __future__ import annotations

import unicodedata


def name_matches(typed_line: str, stored: str) -> bool:
    """`typed_line` with only its trailing newline stripped, compared to `stored`,
    both normalised to NFC. No other trimming or folding: a stray leading space is a
    wrong answer, not a near miss."""
    without_newline = typed_line[:-1] if typed_line.endswith("\n") else typed_line
    return unicodedata.normalize("NFC", without_newline) == unicodedata.normalize("NFC", stored)
