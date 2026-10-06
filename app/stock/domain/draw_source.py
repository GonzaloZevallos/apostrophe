"""Where a draw comes from (CONTEXT.md: Draw, Stock withdrawal, Promotion, Own use;
ADR-0030).

A `Draw` carries its `DrawSource` explicitly: no code tells a draw's kind by a missing
`sale_id`, pricing rule or line total. Every branch over `DrawSource` is an exhaustive
`match` ending in `assert_never`, with no default.
"""

from __future__ import annotations

from enum import Enum
from typing import assert_never


class DrawSource(Enum):
    ADJUSTMENT = "adjustment"
    SALE_LINE = "sale_line"
    PROMOTION = "promotion"
    OWN_USE = "own_use"


class WithdrawalReason(Enum):
    """Why grams were taken out of stock with no sale (CONTEXT.md: Promotion, Own
    use). The values are what the database stores."""

    PROMOTION = "promotion"
    OWN_USE = "own_use"


def draw_source_of(reason: WithdrawalReason) -> DrawSource:
    match reason:
        case WithdrawalReason.PROMOTION:
            return DrawSource.PROMOTION
        case WithdrawalReason.OWN_USE:
            return DrawSource.OWN_USE
        case _:
            assert_never(reason)
