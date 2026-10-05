"""The plain, dated facts `period_figures` sums (ADR-0020). Each capability's own
port (`app/results/application/ports.py`) answers these shapes; the domain only ever
reads them, never SQLAlchemy or any adapter."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from typing import Literal

from app.shared.grams import Grams

DrawKind = Literal["sold", "gifted", "shortfall"]


@dataclass(frozen=True)
class DrawRow:
    """One draw, already allocated against its lots. `variety_id`, `variety_name`,
    `sale_id` and `line_total` are `None` exactly when `kind` is `shortfall`: a
    negative adjustment is never a sale line (CONTEXT.md: Stock shortfall) and never
    carries a line total of its own."""

    kind: DrawKind
    day: date
    variety_id: int | None
    variety_name: str | None
    sale_id: int | None
    line_total: int | None
    grams: Grams
    costed: int | None
    pending: Grams

    def __post_init__(self) -> None:
        if self.kind == "shortfall":
            if self.variety_id is not None or self.sale_id is not None:
                raise ValueError("a shortfall draw carries no variety or sale")
            if self.line_total is not None:
                raise ValueError("a shortfall draw carries no line total")
        else:
            if self.variety_id is None or self.sale_id is None or self.line_total is None:
                raise ValueError("a sale-line draw carries its variety, sale and line total")


@dataclass(frozen=True)
class SaleRecord:
    """One sale, as `period_figures` needs it: `total` is the sale's full total,
    shipping included (CONTEXT.md: Sale)."""

    sale_id: int
    day: date
    shipping: int
    total: int


@dataclass(frozen=True)
class PaymentRecord:
    day: date
    amount: int


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
