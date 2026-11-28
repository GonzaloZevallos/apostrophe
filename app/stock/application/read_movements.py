"""Read a business's stock movements, entries and withdrawals mixed, newest first, one
page at a time behind an opaque cursor (CONTEXT.md: Stock entry, Stock withdrawal).

The use case only reads: it never writes and never commits. The adapter owns "strictly
after the cursor" (`BusinessMovements.page`); this module merges the two kinds in the
movement order, cuts the page and labels it.
"""

from dataclasses import dataclass

from app.stock.application.errors import MovementLabelMissing
from app.stock.application.ports import (
    BusinessMovements,
    ProductLabel,
    ProductLabels,
    WithdrawalReasons,
)
from app.stock.domain.entry import StockEntry
from app.stock.domain.movement_order import (
    ENTRY_RANK,
    MOVEMENTS_PAGE_MAX,
    WITHDRAWAL_RANK,
    MovementCursor,
    MovementKey,
)
from app.stock.domain.withdrawal import Withdrawal


@dataclass(frozen=True)
class BusinessMovementsPage:
    """One page of movements in the movement order, the label of each product and the
    name of each reason it shows (by id), and the cursor of the next page, `None` on the
    last."""

    rows: list[StockEntry | Withdrawal]
    next: str | None
    labels: dict[int, ProductLabel]
    reason_names: dict[int, str]


def key_of(row: StockEntry | Withdrawal) -> MovementKey:
    """Where a stored row sits in the movement order: the one place a key is built from
    a row."""
    assert row.id is not None
    if isinstance(row, StockEntry):
        return MovementKey(row.entry_date, row.recorded_at, ENTRY_RANK, row.id)
    return MovementKey(row.withdrawn_on, row.recorded_at, WITHDRAWAL_RANK, row.id)


def read_business_movements(
    movements: BusinessMovements,
    labels: ProductLabels,
    reasons: WithdrawalReasons,
    before: str | None,
    limit: int,
) -> BusinessMovementsPage:
    if not 1 <= limit <= MOVEMENTS_PAGE_MAX:
        raise ValueError(f"a page has between 1 and {MOVEMENTS_PAGE_MAX} movements")
    cursor = None if before is None else MovementCursor.decode(before)
    ordered = sorted(
        movements.page(cursor, limit),
        key=lambda row: key_of(row).newest_first(),
    )
    rows = ordered[:limit]

    variety_ids: set[int] = set()
    for row in rows:
        if isinstance(row, StockEntry):
            variety_ids.add(row.variety_id)
        else:
            variety_ids.update(line.variety_id for line in row.lines)
    found = labels.labels(variety_ids)
    reason_names = {reason.id: reason.name.value for reason in reasons.all()}
    wanted_reasons = {row.reason_id for row in rows if isinstance(row, Withdrawal)}
    if not variety_ids <= found.keys() or not wanted_reasons <= reason_names.keys():
        raise MovementLabelMissing

    return BusinessMovementsPage(
        rows=rows,
        next=MovementCursor.encode(key_of(rows[-1])) if len(ordered) > limit else None,
        labels={i: found[i] for i in variety_ids},
        reason_names={i: reason_names[i] for i in wanted_reasons},
    )
