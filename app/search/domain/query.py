"""The text a user typed into search, as the grouped search reads it (GH-1059).

`SearchQuery` is built once from the raw text; every port receives the whole query and
compares names through `app.shared.names` over `folded`, never by folding again.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

from app.shared.names import fold

GROUP_LIMIT = 5

# Names are capped at 60 characters and phones at 15 digits, so a longer query can match
# neither.
MAX_QUERY_LENGTH = 200

# 9 digits is below SQLite's 64-bit limit and above any real Sale number.
_SALE_NUMBER = re.compile(r"#?(\d{1,9})")


@dataclass(frozen=True)
class SearchQuery:
    q: str
    folded: str
    is_short: bool
    # Purely syntactic: 0 is valid here and matches no Sale, since numbers start at 1.
    # A short query such as '5' still has one: callers check `is_short` first.
    sale_number: int | None

    @classmethod
    def of(cls, raw: str) -> SearchQuery:
        q = raw.strip()
        folded = fold(q)
        is_short = len(q) <= 1 or q == "#" or folded == "" or len(q) > MAX_QUERY_LENGTH
        match = _SALE_NUMBER.fullmatch(q)
        return cls(q, folded, is_short, int(match.group(1)) if match else None)
