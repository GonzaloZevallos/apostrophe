"""Today's oldest-debtors block, pure (docs/adr/20261119-*, amendment GH-497 part 3).

A Customer's Debt age is the days from its Owing since, with levels none, warning and
overdue. The Owing since is the one `settle()` already produced; Sales are never walked
against Payments a second time. The limits and `age_in_days` live only in
`app.shared.debt_age`. `domain/` never imports `application/`, so the input is read
through structural protocols, as in `sorting.py`; `today` is always a parameter.
"""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass
from datetime import date
from typing import Literal, Protocol

from app.shared.debt_age import RECENT_UP_TO_DAYS, WARNING_UP_TO_DAYS, age_in_days
from app.shared.names import fold

AgeLevel = Literal["none", "warning", "overdue"]

OWED_ROWS = 3


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
    name: str
    balance: int
    owing_since: date
    age_days: int
    age_level: AgeLevel
    phone: str | None

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
    rows = tuple(
        OwedRow(
            customer_id=d.customer_id,
            name=d.name,
            balance=d.balance,
            owing_since=d.owing_since,
            age_days=age_in_days(d.owing_since, today),
            age_level=age_level(age_in_days(d.owing_since, today)),
            phone=d.phone,
        )
        for d in ordered[:OWED_ROWS]
    )
    return OwedSummary(
        total_owed=debts.total_owed,
        debtor_count=len(debts.debtors),
        sales_owing_count=debts.sales_owing_count,
        debtors=rows,
    )
