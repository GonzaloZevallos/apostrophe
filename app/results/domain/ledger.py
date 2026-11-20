"""The plain, dated facts `period_figures` sums (ADR-0020). Each capability's own
port (`app/results/application/ports.py`) answers these shapes; the domain only ever
reads them, never SQLAlchemy or any adapter."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, datetime, timedelta
from typing import Literal, assert_never

from app.shared.quantity import Quantity

DrawKind = Literal["sold", "gifted", "shortfall", "withdrawal"]


@dataclass(frozen=True)
class DrawRow:
    """One draw, already allocated against its lots. `variety_id`, `variety_name`,
    `sale_id` and `line_total` are `None` unless `kind` is `sold` or `gifted`: a
    negative adjustment is never a sale line (CONTEXT.md: Stock shortfall) and a stock
    withdrawal is never a sale, so neither carries a line total of its own.
    `reason_id` is the withdrawal reason, present exactly when `kind` is `withdrawal`."""

    kind: DrawKind
    day: date
    variety_id: int | None
    variety_name: str | None
    sale_id: int | None
    line_total: int | None
    quantity: Quantity
    costed: int | None
    pending: Quantity
    reason_id: int | None = None

    def __post_init__(self) -> None:
        match self.kind:
            case "sold" | "gifted":
                if self.variety_id is None or self.sale_id is None or self.line_total is None:
                    raise ValueError("a sale-line draw carries its variety, sale and line total")
            case "shortfall" | "withdrawal":
                if self.variety_id is not None or self.sale_id is not None:
                    raise ValueError("a shortfall or withdrawal draw carries no variety or sale")
                if self.line_total is not None:
                    raise ValueError("a shortfall or withdrawal draw carries no line total")
            case _:
                assert_never(self.kind)
        if (self.kind == "withdrawal") != (self.reason_id is not None):
            raise ValueError("a withdrawal draw carries its reason, and no other draw does")


@dataclass(frozen=True)
class ReasonRecord:
    """One withdrawal reason of the business, in the order `WithdrawalReasons` answers
    it (`position`, then `reason_id`)."""

    reason_id: int
    name: str
    position: int


@dataclass(frozen=True)
class PaymentMethodRecord:
    """One Payment method of the business, archived ones included, in no particular
    order: `money_in` orders by `position`, then `payment_method_id`."""

    payment_method_id: int
    name: str
    position: int


@dataclass(frozen=True)
class SaleRecord:
    """One sale, as `period_figures` needs it: `total` is the sale's full total,
    shipping included (CONTEXT.md: Sale). `recorded_at` is the instant it was recorded, in
    UTC; only the domain turns it into a local time, given the zone."""

    sale_id: int
    day: date
    shipping: int
    total: int
    recorded_at: datetime = field(kw_only=True)

    def __post_init__(self) -> None:
        if self.recorded_at.tzinfo is None or self.recorded_at.utcoffset() != timedelta(0):
            raise ValueError("a sale record's recorded_at is an aware UTC instant")


@dataclass(frozen=True)
class PaymentRecord:
    day: date
    amount: int
    payment_method_id: int = field(kw_only=True)


@dataclass(frozen=True)
class ExpenseRecord:
    day: date
    amount: int
    category_id: int
    name: str
    name_key: str


@dataclass(frozen=True)
class PurchaseRecord:
    day: date
    total_cost: int
