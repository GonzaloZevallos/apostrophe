"""`history`: the one assembly of a business's lots and draws (CONTEXT.md: Lot, Draw;
ADR-0031). It reads the three sources — stock entries, sale-line draws and
withdrawal-line draws — with the same `variety_ids` (`None` for every variety) and
hands them to `lots_and_draws`, whose only caller it is. Every reader that costs or
counts grams (`read_stock`, `read_variety_stock`, `costs_for_sale`, `SqlDrawCosts`,
`SqlStockFigures`) calls this, so a source added later is added in one place, and
`withdrawal_draws` is a required argument so a reader that forgets it does not
compile.
"""

from __future__ import annotations

from collections.abc import Collection

from app.stock.application.ports import Draws, StockEntries, WithdrawalDraws
from app.stock.domain.lot_order import Draw, Lot, lots_and_draws


def history(
    entries: StockEntries,
    draws: Draws,
    withdrawal_draws: WithdrawalDraws,
    variety_ids: Collection[int] | None,
) -> dict[int, tuple[list[Lot], list[Draw]]]:
    return lots_and_draws(
        entries.for_varieties(variety_ids),
        draws.for_varieties(variety_ids),
        withdrawal_draws.for_varieties(variety_ids),
    )
