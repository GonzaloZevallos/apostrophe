"""Where a draw comes from (CONTEXT.md: Draw, Stock withdrawal; ADR-0031).

A `Draw` carries its `DrawSource` explicitly: no code tells a draw's kind by a missing
`sale_id`, pricing rule or line total. Every branch over `DrawSource` is an exhaustive
`match` ending in `assert_never`, with no default. A withdrawal is one source whatever
its reason: the reason is the business's own list (`withdrawal_reason.py`) and never
moves a lot, so it rides on the `Draw` as an id for results to group by.
"""

from __future__ import annotations

from enum import Enum


class DrawSource(Enum):
    ADJUSTMENT = "adjustment"
    SALE_LINE = "sale_line"
    WITHDRAWAL = "withdrawal"
