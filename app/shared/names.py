"""The name rule shared by every capability that names something the user types
(CONTEXT.md: Variety name, Expense category): trimmed, inner spaces collapsed, at
most a capability-chosen length, and compared case-insensitively.

This module only reports a problem; it never raises. Each capability's own value
object (`VarietyName`, `CategoryName`, ...) turns a `NameProblem` into its own error
type and message, so the wording stays the capability's to choose.
"""

from __future__ import annotations

import unicodedata
from enum import Enum, auto


def fold(text: str) -> str:
    """NFKD, combining marks dropped, casefolded, whitespace collapsed to single
    spaces and trimmed. The one way names are compared for search and sort (the
    plan's invariant): every ordering of customers by name uses this, in Python,
    never an SQL `ORDER BY` on the name."""
    decomposed = unicodedata.normalize("NFKD", text)
    without_marks = "".join(c for c in decomposed if not unicodedata.combining(c))
    return " ".join(without_marks.casefold().split())


class NameProblem(Enum):
    EMPTY = auto()
    UNTRIMMED = auto()
    TOO_LONG = auto()


def collapse_spaces(raw: str) -> str:
    """Trim and collapse runs of inner whitespace to a single space."""
    return " ".join(raw.split())


def name_problem(value: str, max_length: int) -> NameProblem | None:
    """The first rule `value` breaks, checked in the order a caller should report
    them: empty, then untrimmed or with collapsed inner spaces, then too long.
    `None` means the name is well-formed."""
    if not value:
        return NameProblem.EMPTY
    if value != collapse_spaces(value):
        return NameProblem.UNTRIMMED
    if len(value) > max_length:
        return NameProblem.TOO_LONG
    return None


def name_key(value: str) -> str:
    """The case-insensitive key two names are compared by."""
    return value.casefold()
