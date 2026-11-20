"""The Today block's own selections (PRD "Today read model"): which Products are low on
stock and in what order, and which sold best this week.

Pure, like `sorting.py`: the window arrives as `since`/`through` dates already worked out
by `periods`, so nothing here knows a weekday, a month or a time zone. `low_stock` reads
the status and Days left stock already produced (`StockRow`) and never judges them a
second time; `best_sellers` sums only the line totals the draws already carry.
"""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass
from datetime import date
from typing import Protocol

from app.results.domain.ledger import DrawRow
from app.shared.names import fold
from app.shared.quantity import Quantity

SOLD_OUT = "sold_out"
LOW = "low"
BEST_SELLERS_LIMIT = 4

_LOW_STOCK_ORDER = {SOLD_OUT: 0, LOW: 1}


class _LowStockRow(Protocol):
    # Read-only (`@property`), as `sorting._NamedDebt`: `StockRow` is a frozen dataclass.
    @property
    def variety_id(self) -> int: ...
    @property
    def name(self) -> str: ...
    @property
    def quantity(self) -> Quantity: ...
    @property
    def status(self) -> str: ...
    @property
    def days_left(self) -> int | None: ...


@dataclass(frozen=True)
class LowStock[S]:
    """The rows and their count from one function: a count that disagrees with its rows
    cannot be built (plan invariant: the front never counts)."""

    count: int
    rows: tuple[S, ...]

    def __post_init__(self) -> None:
        if self.count != len(self.rows):
            raise ValueError("count must equal the number of rows")


def low_stock[S: _LowStockRow](rows: Sequence[S]) -> LowStock[S]:
    """Sold out, then low; inside each, fewest Days left first and none last, then the
    folded name, then the id. `no_entries` and `ok` rows are not listed."""
    listed = [row for row in rows if row.status in _LOW_STOCK_ORDER]
    ordered = sorted(
        listed,
        key=lambda row: (
            _LOW_STOCK_ORDER[row.status],
            row.days_left is None,
            row.days_left if row.days_left is not None else 0,
            fold(row.name),
            row.variety_id,
        ),
    )
    return LowStock(count=len(ordered), rows=tuple(ordered))


@dataclass(frozen=True)
class BestSeller:
    variety_id: int
    name: str
    sales: int


def best_sellers(
    draws: Sequence[DrawRow],
    since: date,
    through: date,
    limit: int = BEST_SELLERS_LIMIT,
) -> tuple[BestSeller, ...]:
    """Money per Product from `since` through `through`: the sum of each sale line's
    stored total, a gift counted as 0 whatever its stored total. Products at $0 are
    dropped; the biggest first, ties by folded name then id; at most `limit`."""
    totals: dict[int, int] = {}
    names: dict[int, str] = {}
    for draw in draws:
        if draw.kind not in ("sold", "gifted") or not since <= draw.day <= through:
            continue
        if draw.variety_id is None or draw.variety_name is None or draw.line_total is None:
            raise ValueError("a sale-line draw carries its variety, name and line total")
        if names.setdefault(draw.variety_id, draw.variety_name) != draw.variety_name:
            raise ValueError("one product carries two names")
        charged = 0 if draw.kind == "gifted" else draw.line_total
        totals[draw.variety_id] = totals.get(draw.variety_id, 0) + charged
    sellers = [
        BestSeller(variety_id=variety_id, name=names[variety_id], sales=sales)
        for variety_id, sales in totals.items()
        if sales != 0
    ]
    sellers.sort(key=lambda seller: (-seller.sales, fold(seller.name), seller.variety_id))
    return tuple(sellers[:limit])
