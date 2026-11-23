"""The Today block's own selections and orderings, pure.

Low stock and best sellers (PRD "Today read model"): which Products are low on stock and
in what order, and which sold best this week. The window arrives as `since`/`through`
dates already worked out by `periods`, so nothing here knows a weekday, a month or a time
zone. `low_stock` reads the status and Days left stock already produced (`StockRow`) and
never judges them a second time; `best_sellers` sums only the line totals the draws
already carry.

Oldest debtors (docs/adr/20261119-*, amendment GH-497 part 3): a Customer's Debt age is
the days from its Owing since, with levels none, warning and overdue. The Owing since is
the one `settle()` already produced; Sales are never walked against Payments a second
time. The limits and `age_in_days` live only in `app.shared.debt_age`. `domain/` never
imports `application/`, so the input is read through structural protocols, as in
`sorting.py`; `today` is always a parameter. The oldest-debtors code needs only the
standard library, `app.shared.names` and `app.shared.debt_age`; the other imports serve
`low_stock` and `best_sellers`.
"""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass, field
from datetime import date
from typing import Literal, Protocol

from app.results.domain.ledger import DrawRow
from app.shared.debt_age import RECENT_UP_TO_DAYS, WARNING_UP_TO_DAYS, age_in_days
from app.shared.names import fold
from app.shared.quantity import Quantity

AgeLevel = Literal["none", "warning", "overdue"]

OWED_ROWS = 3

SOLD_OUT = "sold_out"
LOW = "low"
BEST_SELLERS_LIMIT = 4

_LOW_STOCK_ORDER = {SOLD_OUT: 0, LOW: 1}


class _OwedDebt(Protocol):
    # Read-only (`@property`) so a frozen dataclass satisfies it, as in `sorting.py`.
    @property
    def customer_id(self) -> int: ...
    @property
    def name(self) -> str: ...
    @property
    def balance(self) -> int: ...
    @property
    def owing_since(self) -> date: ...
    @property
    def phone(self) -> str | None: ...


class _DebtsRead(Protocol):
    @property
    def total_owed(self) -> int: ...
    @property
    def sales_owing_count(self) -> int: ...
    @property
    def debtors(self) -> Sequence[_OwedDebt]: ...


@dataclass(frozen=True)
class OwedRow:
    customer_id: int
    name: str = field(repr=False)
    balance: int
    owing_since: date
    age_days: int
    age_level: AgeLevel
    phone: str | None = field(repr=False)

    def __post_init__(self) -> None:
        if self.age_days < 0:
            raise ValueError("age_days cannot be negative")
        if self.balance <= 0:
            raise ValueError("balance must be above zero")


@dataclass(frozen=True)
class OwedSummary:
    total_owed: int
    debtor_count: int
    sales_owing_count: int
    debtors: tuple[OwedRow, ...]

    def __post_init__(self) -> None:
        for field, value in (
            ("total_owed", self.total_owed),
            ("debtor_count", self.debtor_count),
            ("sales_owing_count", self.sales_owing_count),
        ):
            if value < 0:
                raise ValueError(f"{field} cannot be negative")
        if len(self.debtors) > OWED_ROWS:
            raise ValueError(f"a summary holds at most {OWED_ROWS} rows")


def age_level(days: int) -> AgeLevel:
    """`none` up to `RECENT_UP_TO_DAYS`, `warning` up to `WARNING_UP_TO_DAYS`, and
    `overdue` after that."""
    if days <= RECENT_UP_TO_DAYS:
        return "none"
    if days <= WARNING_UP_TO_DAYS:
        return "warning"
    return "overdue"


def _owed_row(debt: _OwedDebt, today: date) -> OwedRow:
    days = age_in_days(debt.owing_since, today)
    return OwedRow(
        customer_id=debt.customer_id,
        name=debt.name,
        balance=debt.balance,
        owing_since=debt.owing_since,
        age_days=days,
        age_level=age_level(days),
        phone=debt.phone,
    )


def owed_summary(debts: _DebtsRead, today: date) -> OwedSummary:
    """The `OWED_ROWS` oldest debtors, with the totals of the same `Debts` answer.

    `debts.debtors` is every Customer with a Balance above $0, uncut
    (`view_accounts.debtors()`), so `debtor_count` is its length. `total_owed` and
    `sales_owing_count` are passed through, never summed from rows. The order is by the
    stored `owing_since`, never the clamped `age_days`, so a future-dated debt sorts
    after one dated today.
    """
    ordered = sorted(
        debts.debtors,
        key=lambda d: (d.owing_since, -d.balance, fold(d.name), d.customer_id),
    )
    rows = tuple(_owed_row(d, today) for d in ordered[:OWED_ROWS])
    return OwedSummary(
        total_owed=debts.total_owed,
        debtor_count=len(debts.debtors),
        sales_owing_count=debts.sales_owing_count,
        debtors=rows,
    )


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
