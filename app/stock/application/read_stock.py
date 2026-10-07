"""`GET /stock`'s use case: a business's total grams, every variety's own stock level
and its entries (CONTEXT.md: Stock, Stock status, Days left; ADR-0009). Computed only
through `stock_level` over `lots_and_draws` (stock-domain) — never a SQL aggregate.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date

from app.shared.grams import Grams
from app.stock.application.ports import Draws, StockEntries, Thresholds, VarietyCatalog
from app.stock.domain.entry import StockEntry
from app.stock.domain.lot_order import lots_and_draws
from app.stock.domain.stock_level import StockLevel, stock_level
from app.stock.domain.threshold import Threshold


@dataclass(frozen=True)
class VarietyStock:
    variety_id: int
    level: StockLevel
    threshold: Threshold | None


@dataclass(frozen=True)
class StockView:
    total: Grams
    varieties: list[VarietyStock]
    entries: list[StockEntry]


def read_stock(
    entries: StockEntries,
    draws: Draws,
    catalog: VarietyCatalog,
    thresholds: Thresholds,
    today: date,
    *,
    archived: bool = False,
) -> StockView:
    all_entries = entries.for_varieties(None)
    sale_draws = draws.for_varieties(None)
    grouped = lots_and_draws(all_entries, sale_draws)
    threshold_map = thresholds.all()

    def level_of(variety_id: int) -> StockLevel:
        lots, variety_draws = grouped.get(variety_id, ([], []))
        return stock_level(lots, variety_draws, threshold_map.get(variety_id), today)

    # The total counts every variety, archived ones included: their grams are still on
    # hand (docs/adr/0031). The rows are the listed varieties, or the archived ones when
    # asked; rows and total stop sharing a filter.
    levels = {variety_id: level_of(variety_id) for variety_id in grouped}
    total = sum(level.grams.hundredths for level in levels.values())
    varieties = [
        VarietyStock(
            variety_id,
            levels[variety_id] if variety_id in levels else level_of(variety_id),
            threshold_map.get(variety_id),
        )
        for variety_id in sorted(catalog.archived_ids() if archived else catalog.listed_ids())
    ]

    sorted_entries = sorted(
        all_entries, key=lambda entry: (entry.entry_date, entry.recorded_at, entry.id), reverse=True
    )
    return StockView(Grams(total), varieties, sorted_entries)


def read_variety_stock(
    entries: StockEntries, draws: Draws, thresholds: Thresholds, variety_id: int, today: date
) -> VarietyStock:
    """The same computation as `read_stock`, narrowed to one variety: used after
    `set_threshold` writes, so the route can answer that variety's own row without a
    second full sweep."""
    narrowed = {variety_id}
    grouped = lots_and_draws(entries.for_varieties(narrowed), draws.for_varieties(narrowed))
    lots, variety_draws = grouped.get(variety_id, ([], []))
    threshold = thresholds.get(variety_id)
    level = stock_level(lots, variety_draws, threshold, today)
    return VarietyStock(variety_id, level, threshold)
