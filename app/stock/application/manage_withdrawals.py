"""The stock withdrawal use cases (CONTEXT.md: Stock withdrawal): record, edit, delete,
read one, and read a variety's movements (its entries and withdrawals mixed).

A withdrawal is never refused for lack of stock, nor because its grams were already
drawn from lots (ADR-0009): the lots after it are worked out again on the next read.
Checks run in this order: the withdrawal (404), every line's variety (404, a missing one
before an archived one), then the domain rules (422), so a foreign variety never reaches
the grams, date or reason rules.
Each use case that writes commits once, at its end, through `Transaction`
(CODING_STANDARDS section 9).
"""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal

from app.shared.transaction import Transaction
from app.stock.application.errors import VarietyNotFound
from app.stock.application.ports import (
    StockEntries,
    VarietyCatalog,
    WithdrawalMovement,
    Withdrawals,
)
from app.stock.application.variety_use import require_usable
from app.stock.domain.draw_source import WithdrawalReason
from app.stock.domain.entry import StockEntry
from app.stock.domain.errors import WithdrawalNotFound, WithdrawalVarietyNotFound
from app.stock.domain.withdrawal import Withdrawal, WithdrawalLine

# A line as the request carries it: the variety and its grams, not yet validated.
LineInput = tuple[int, Decimal]


@dataclass(frozen=True)
class WithdrawalView:
    """A withdrawal with the name of each line's variety, for the answer."""

    withdrawal: Withdrawal
    variety_names: dict[int, str]


Movement = StockEntry | WithdrawalMovement


def _built(
    catalog: VarietyCatalog,
    reason: WithdrawalReason | str | None,
    withdrawn_on: date,
    note: str | None,
    lines: Sequence[LineInput],
    today: date,
    recorded_at: datetime,
    withdrawal_id: int | None,
    kept: frozenset[int],
) -> Withdrawal:
    """`kept` holds the varieties the stored withdrawal already has on a line: only those
    may be archived (ADR-0032). A missing variety is refused before any archived one."""
    distinct = list(dict.fromkeys(variety_id for variety_id, _ in lines))
    for variety_id in distinct:
        if not catalog.exists(variety_id):
            raise WithdrawalVarietyNotFound()
    for variety_id in distinct:
        require_usable(catalog, variety_id, keeps=variety_id in kept)
    return Withdrawal.of(
        reason,
        withdrawn_on,
        note,
        tuple(WithdrawalLine.of(variety_id, quantity) for variety_id, quantity in lines),
        today,
        recorded_at,
        withdrawal_id,
    )


def _viewed(catalog: VarietyCatalog, withdrawal: Withdrawal) -> WithdrawalView:
    names = catalog.names()
    return WithdrawalView(
        withdrawal, {line.variety_id: names[line.variety_id] for line in withdrawal.lines}
    )


def _stored(withdrawals: Withdrawals, withdrawal_id: int) -> Withdrawal:
    withdrawal = withdrawals.by_id(withdrawal_id)
    if withdrawal is None:
        raise WithdrawalNotFound()
    return withdrawal


def record_withdrawal(
    withdrawals: Withdrawals,
    catalog: VarietyCatalog,
    transaction: Transaction,
    *,
    reason: str | None,
    withdrawn_on: date,
    note: str | None,
    lines: Sequence[LineInput],
    today: date,
    now: datetime,
) -> WithdrawalView:
    withdrawal = _built(catalog, reason, withdrawn_on, note, lines, today, now, None, frozenset())
    stored = withdrawals.add(withdrawal)
    transaction.commit()
    return _viewed(catalog, stored)


def edit_withdrawal(
    withdrawals: Withdrawals,
    catalog: VarietyCatalog,
    transaction: Transaction,
    withdrawal_id: int,
    *,
    reason: str | None,
    withdrawn_on: date,
    note: str | None,
    lines: Sequence[LineInput],
    today: date,
) -> WithdrawalView:
    """`id` and `recorded_at` carry through from the stored withdrawal: an edit never
    changes either."""
    existing = _stored(withdrawals, withdrawal_id)
    updated = _built(
        catalog,
        reason,
        withdrawn_on,
        note,
        lines,
        today,
        existing.recorded_at,
        existing.id,
        frozenset(line.variety_id for line in existing.lines),
    )
    stored = withdrawals.replace(updated)
    transaction.commit()
    return _viewed(catalog, stored)


def delete_withdrawal(
    withdrawals: Withdrawals, transaction: Transaction, withdrawal_id: int
) -> None:
    withdrawal = _stored(withdrawals, withdrawal_id)
    assert withdrawal.id is not None
    withdrawals.remove(withdrawal.id)
    transaction.commit()


def read_withdrawal(
    withdrawals: Withdrawals, catalog: VarietyCatalog, withdrawal_id: int
) -> WithdrawalView:
    return _viewed(catalog, _stored(withdrawals, withdrawal_id))


def _newest_first(movement: Movement) -> tuple[int, float, int, int]:
    """(day desc, recorded_at desc, kind, id desc) as one ascending key."""
    match movement:
        case StockEntry():
            assert movement.id is not None
            return (
                -movement.entry_date.toordinal(),
                -movement.recorded_at.timestamp(),
                0,
                -movement.id,
            )
        case WithdrawalMovement():
            return (
                -movement.withdrawn_on.toordinal(),
                -movement.recorded_at.timestamp(),
                1,
                -movement.withdrawal_id,
            )


def read_movements(
    entries: StockEntries,
    withdrawals: Withdrawals,
    catalog: VarietyCatalog,
    variety_id: int,
) -> list[Movement]:
    """A variety's stock entries and withdrawals mixed, newest first. A variety that is
    not this business's raises stock's internal `VarietyNotFound`, which the router
    turns into the one `variety.not_found` 404, so another business's variety reveals
    nothing."""
    if not catalog.exists(variety_id):
        raise VarietyNotFound()
    movements: list[Movement] = [
        *entries.for_varieties({variety_id}),
        *withdrawals.movements_of(variety_id),
    ]
    return sorted(movements, key=_newest_first)
