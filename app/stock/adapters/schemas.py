"""The HTTP shapes of a stock entry. Bare: no pydantic length or value constraint, so
every rule stays the domain's and its message is a fixed string (ADR-0005). Quantity are
typed `Decimal` here and become `Quantity` only through `Quantity.of`, at the router; every
quantity value out uses the shared `QuantityOut` (CODING_STANDARDS: no second quantity format).
"""

from datetime import date
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel

from app.products.adapters.schemas import QuantityOut
from app.stock.application.manage_withdrawals import Movement, WithdrawalView
from app.stock.application.ports import WithdrawalMovement
from app.stock.application.read_stock import StockView, VarietyStock
from app.stock.domain.costing import cost_per_gram
from app.stock.domain.draw_source import WithdrawalReason
from app.stock.domain.entry import Origin, StockEntry

# The four values `stock_level` (stock-domain) answers; declared here so every
# subtask that reads or writes a status reads the one literal type, never a bare str.
Status = Literal["no_entries", "sold_out", "low", "ok"]

# A bare `date` inside `EntryIn`/`EntryOut` would otherwise resolve to the field named
# `date`, not the type (the same trap `app.sales.adapters.schemas.SaleDate` documents).
EntryDate = date


class EntryIn(BaseModel):
    date: EntryDate | None = None
    variety_id: int
    origin: Origin
    quantity: Decimal
    total_cost: int | None = None
    note: str | None = None


class EntryOut(BaseModel):
    id: int
    date: EntryDate
    variety_id: int
    origin: Origin
    quantity: QuantityOut
    total_cost: int | None
    cost_per_gram: int | None
    note: str | None

    @classmethod
    def of(cls, entry: StockEntry) -> "EntryOut":
        assert entry.id is not None, "only stored entries go out"
        total_cost = entry.total_cost
        per_gram = (
            cost_per_gram(total_cost, entry.quantity)
            if total_cost is not None and entry.quantity.is_positive
            else None
        )
        return cls(
            id=entry.id,
            date=entry.entry_date,
            variety_id=entry.variety_id,
            origin=entry.origin,
            quantity=entry.quantity.as_decimal(),
            total_cost=entry.total_cost,
            cost_per_gram=per_gram,
            note=entry.note,
        )


class ThresholdIn(BaseModel):
    """`PUT /stock/varieties/{variety_id}/threshold`'s body: `None` turns the
    threshold off, rather than storing a zero or negative one (`Threshold.of`
    refuses both)."""

    quantity: Decimal | None


class VarietyStockOut(BaseModel):
    """One variety's row in `GET /stock` (and the threshold route's own response):
    computed only by `stock_level` over `lots_and_draws` (stock-domain), never by a
    SQL aggregate or front code."""

    variety_id: int
    quantity: QuantityOut
    status: Status
    sold_out_since: date | None
    threshold: QuantityOut | None
    days_left: int | None

    @classmethod
    def of(cls, view: VarietyStock) -> "VarietyStockOut":
        level = view.level
        return cls(
            variety_id=view.variety_id,
            quantity=level.quantity.as_decimal(),
            status=level.status,
            sold_out_since=level.sold_out_since,
            threshold=view.threshold.quantity.as_decimal() if view.threshold is not None else None,
            days_left=level.days_left,
        )


class StockOut(BaseModel):
    """`GET /stock`'s own shape: the business's total grams, every variety's own row,
    and its entries, newest date first then most recently recorded first."""

    total: QuantityOut
    varieties: list[VarietyStockOut]
    entries: list[EntryOut]

    @classmethod
    def of(cls, view: StockView) -> "StockOut":
        return cls(
            total=view.total.as_decimal(),
            varieties=[VarietyStockOut.of(variety) for variety in view.varieties],
            entries=[EntryOut.of(entry) for entry in view.entries],
        )


class WithdrawalLineIn(BaseModel):
    variety_id: int
    quantity: Decimal


class WithdrawalIn(BaseModel):
    """Bare (ADR-0005): `reason` is optional here so a missing one is the domain's
    coded refusal, not a pydantic error that would echo the input."""

    reason: str | None = None
    date: EntryDate | None = None
    note: str | None = None
    lines: list[WithdrawalLineIn]


class WithdrawalLineOut(BaseModel):
    variety_id: int
    variety_name: str
    quantity: QuantityOut


class WithdrawalOut(BaseModel):
    id: int
    reason: WithdrawalReason
    date: EntryDate
    note: str | None
    total_quantity: QuantityOut
    lines: list[WithdrawalLineOut]

    @classmethod
    def of(cls, view: WithdrawalView) -> "WithdrawalOut":
        withdrawal = view.withdrawal
        assert withdrawal.id is not None, "only stored withdrawals go out"
        return cls(
            id=withdrawal.id,
            reason=withdrawal.reason,
            date=withdrawal.withdrawn_on,
            note=withdrawal.note,
            total_quantity=withdrawal.total_quantity.as_decimal(),
            lines=[
                WithdrawalLineOut(
                    variety_id=line.variety_id,
                    variety_name=view.variety_names[line.variety_id],
                    quantity=line.quantity.as_decimal(),
                )
                for line in withdrawal.lines
            ],
        )


class EntryMovementOut(EntryOut):
    kind: Literal["entry"] = "entry"


class WithdrawalMovementOut(BaseModel):
    kind: Literal["withdrawal"] = "withdrawal"
    id: int
    date: EntryDate
    reason: WithdrawalReason
    quantity: QuantityOut


MovementOut = EntryMovementOut | WithdrawalMovementOut


def movement_out(movement: Movement) -> MovementOut:
    if isinstance(movement, WithdrawalMovement):
        return WithdrawalMovementOut(
            id=movement.withdrawal_id,
            date=movement.withdrawn_on,
            reason=movement.reason,
            quantity=movement.quantity.as_decimal(),
        )
    return EntryMovementOut(**EntryOut.of(movement).model_dump())
