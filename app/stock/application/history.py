"""`history`: the one assembly of a business's lots and draws (CONTEXT.md: Lot, Draw;
ADR-0031). It reads the three sources — stock entries, sale-line draws and
withdrawal-line draws — with the same `variety_ids` (`None` for every variety) and
hands them to `_assemble`, the only caller of `lots_and_draws`. Every reader that costs
or counts grams (`read_stock`, `read_variety_stock`, `costs_for_sale`, `SqlDrawCosts`,
`SqlStockFigures`) calls this, so a source added later is added in one place, and
`withdrawal_draws` is a required argument so a reader that forgets it does not
compile.

`business_history` is the same read for the whole business, and also answers the stock
entry rows it read next to the grouped lots and draws, so `GET /stock` reads
`stock_entry` once (GH-125). It owns its reads, so its entries and draws can never
disagree.
"""

from __future__ import annotations

from collections.abc import Collection
from dataclasses import dataclass

from app.stock.application.ports import Draws, StockEntries, WithdrawalDraws
from app.stock.domain.entry import StockEntry
from app.stock.domain.lot_order import (
    Draw,
    Lot,
    SaleLineDraw,
    WithdrawalLineDraw,
    lots_and_draws,
)


@dataclass(frozen=True)
class BusinessHistory:
    """The whole business's grouped lots and draws, with the entry rows they came from."""

    grouped: dict[int, tuple[list[Lot], list[Draw]]]
    entries: list[StockEntry]


def _assemble(
    entry_rows: list[StockEntry],
    sale_draws: list[SaleLineDraw],
    withdrawal_draws: list[WithdrawalLineDraw],
) -> dict[int, tuple[list[Lot], list[Draw]]]:
    return lots_and_draws(entry_rows, sale_draws, withdrawal_draws)


def history(
    entries: StockEntries,
    draws: Draws,
    withdrawal_draws: WithdrawalDraws,
    variety_ids: Collection[int] | None,
) -> dict[int, tuple[list[Lot], list[Draw]]]:
    return _assemble(
        entries.for_varieties(variety_ids),
        draws.for_varieties(variety_ids),
        withdrawal_draws.for_varieties(variety_ids),
    )


def business_history(
    entries: StockEntries,
    draws: Draws,
    withdrawal_draws: WithdrawalDraws,
) -> BusinessHistory:
    entry_rows = entries.for_varieties(None)
    grouped = _assemble(
        entry_rows,
        draws.for_varieties(None),
        withdrawal_draws.for_varieties(None),
    )
    return BusinessHistory(grouped, entry_rows)
