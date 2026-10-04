"""The names the removal prints or writes to disk: the business name made safe for a
terminal, the slug and file name built from it, and whether a resolved path sits
inside another (the plan's invariant: no email, name, phone, amount or note leaves
through any of these, only the business name and fixed text).
"""

from __future__ import annotations

import unicodedata
from datetime import UTC, datetime
from pathlib import Path


def terminal_name(name: str) -> str:
    """`name`, normalised to NFC, with every Unicode control, format, private-use,
    surrogate or unassigned character (general category starting with `C`) replaced
    by its `\\uXXXX` escape, so a name can never plant an escape sequence or a
    newline in the operator's terminal."""
    composed = unicodedata.normalize("NFC", name)
    return "".join(
        character if not unicodedata.category(character).startswith("C") else _escape(character)
        for character in composed
    )


def _escape(character: str) -> str:
    return f"\\u{ord(character):04x}"


def slug(name: str) -> str:
    """The NFC form's ASCII letters and digits, lowercased, split into runs wherever a
    character does not qualify and joined back with `-`; `business` when none qualify
    (an emoji-only name, for one)."""
    composed = unicodedata.normalize("NFC", name)
    parts: list[str] = []
    run: list[str] = []
    for character in composed:
        lowered = character.lower()
        if lowered.isascii() and lowered.isalnum():
            run.append(lowered)
        elif run:
            parts.append("".join(run))
            run = []
    if run:
        parts.append("".join(run))
    return "-".join(parts) if parts else "business"


def file_name(name: str, at: datetime) -> str:
    """`<slug>-YYYYMMDD-HHMMSS.json`, `at` read in UTC."""
    instant = at.astimezone(UTC) if at.tzinfo is not None else at
    return f"{slug(name)}-{instant.strftime('%Y%m%d-%H%M%S')}.json"


def is_inside(path: Path, root: Path) -> bool:
    """Whether `path` is `root` itself or sits somewhere under it. Both must already
    be resolved (symlinks followed, made absolute) by the caller: this is pure path
    arithmetic, never a filesystem lookup."""
    return path == root or root in path.parents
