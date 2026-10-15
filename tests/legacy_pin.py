"""The hand-written pin of every legacy redirect (docs/adr/0033, amendment of GH-134).

Standard library only, on purpose: nothing here may come from the app's own rows, so a
wrong target in `app/legacy_front_paths.json` cannot leak into what pins it."""

from __future__ import annotations

import json
from pathlib import Path

FIXTURE = Path(__file__).resolve().parent / "fixtures" / "legacy_front_paths.json"


class MalformedPinnedRows(ValueError):
    def __init__(self) -> None:
        super().__init__("the pinned legacy rows fixture is malformed")


def parse_pinned_rows(text: str) -> tuple[tuple[str, str], ...]:
    """The (old, now) pairs of the fixture, in file order, `{id}` kept literal. Anything
    but exactly `_`, `rows` and an empty `removed`, rows of exactly `old` and `now` strings
    with no `old` twice, is refused."""
    try:
        document = json.loads(text)
    except json.JSONDecodeError:
        raise MalformedPinnedRows from None
    if not isinstance(document, dict) or set(document) != {"_", "rows", "removed"}:
        raise MalformedPinnedRows
    rows = document["rows"]
    if not isinstance(rows, list) or document["removed"] != []:
        raise MalformedPinnedRows
    pairs: list[tuple[str, str]] = []
    for row in rows:
        if not isinstance(row, dict) or set(row) != {"old", "now"}:
            raise MalformedPinnedRows
        old, now = row["old"], row["now"]
        if not isinstance(old, str) or not isinstance(now, str):
            raise MalformedPinnedRows
        pairs.append((old, now))
    olds = [old for old, _ in pairs]
    if len(set(olds)) != len(olds):
        raise MalformedPinnedRows
    return tuple(pairs)


PINNED_LEGACY_ROWS = parse_pinned_rows(FIXTURE.read_text())
