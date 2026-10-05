"""Lot order: the one order lots and draws are ever read in (CONTEXT.md: Lot, Draw,
Lot order; ADR-0009).

A stock entry is a `Lot` when its grams are positive, a `Draw` when they are not (a
negative adjustment); a sale line (gifts included) is always a `Draw`. Both carry a
`LotOrder`: date first, then recording order — a stock entry's `recorded_at`, a sale
line's own — with `rank` telling the two sources apart so an exact tie never depends on
which table happened to be read first. `lots_and_draws` is the one place a variety's
lots and draws are assembled, grouped and sorted; `allocate` and `stock_level` both read
its answer, never SQL and never a grouping of their own.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime

from app.shared.grams import Grams
from app.stock.domain.entry import StockEntry

STOCK_ENTRY_RANK = 0
SALE_LINE_RANK = 1


@dataclass(frozen=True, order=True)
class LotOrder:
    """`(day, recorded_at, rank, ref_id, position)`: ordered by date, then by
    recording order, with `rank`, `ref_id` and `position` as the tie-breakers that
    make the order total and deterministic."""

    day: date
    recorded_at: datetime
    rank: int
    ref_id: int
    position: int


@dataclass(frozen=True)
class Lot:
    """A positive stock entry: its own cost, carried whole, never a cost per gram
    (`costing.cost_per_gram` is for display only; `allocate` never reads it)."""

    order: LotOrder
    variety_id: int
    grams: Grams
    total_cost: int | None

    def __post_init__(self) -> None:
        if not self.grams.is_positive:
            raise ValueError("a lot's grams are always above zero")


@dataclass(frozen=True)
class Draw:
    """Grams going out of a variety: a sale line (gifts included) or a negative
    adjustment, always carried as a positive magnitude — the direction is already
    `Draw` itself, never a signed `Grams`."""

    order: LotOrder
    variety_id: int
    grams: Grams

    def __post_init__(self) -> None:
        if not self.grams.is_positive:
            raise ValueError("a draw's grams are always above zero")


@dataclass(frozen=True)
class SaleLineDraw:
    """One sale line's draw on its variety's stock (gifts included): the shape the
    `Draws` port (read from `sale_line ⨝ sale`) answers, so this module — and every
    other one under `app/stock/domain/` — never imports `app.sales`
    (CODING_STANDARDS section 1).

    `variety_name`, `line_total` and `pricing_rule` (the stored value, a plain `str`
    so this stays free of `app.sales.domain.pricing.PricingRule`) ride along on the
    same row `Draws` already reads (`sale_line ⨝ sale ⨝ variety`): results' own
    `DrawCosts` (ADR-0013) needs them matched to this exact draw, never joined back by
    `(sale_id, position)` afterwards. They default so the fixtures already built for
    `lots_and_draws` and `costs_for_sale` — which never read them — need no change."""

    variety_id: int
    day: date
    recorded_at: datetime
    sale_id: int
    position: int
    grams: Grams
    variety_name: str = ""
    line_total: int = 0
    pricing_rule: str = "list"


def entry_order(entry: StockEntry) -> LotOrder:
    """A stock entry's `LotOrder` — exported so a caller that needs to match its own
    data back onto `lots_and_draws`' draws (results' `DrawCosts`, ADR-0013) builds the
    identical key instead of inventing a second formula for it."""
    assert entry.id is not None, "only a stored entry is ordered"
    return LotOrder(entry.entry_date, entry.recorded_at, STOCK_ENTRY_RANK, entry.id, 0)


def sale_draw_order(draw: SaleLineDraw) -> LotOrder:
    """A sale-line draw's `LotOrder`, exported for the same reason as `entry_order`."""
    return LotOrder(draw.day, draw.recorded_at, SALE_LINE_RANK, draw.sale_id, draw.position)


def lots_and_draws(
    entries: list[StockEntry], sale_draws: list[SaleLineDraw]
) -> dict[int, tuple[list[Lot], list[Draw]]]:
    """Groups entries and sale-line draws by variety, each group's lots and its
    draws sorted by `LotOrder`. A variety with nothing at all is simply absent."""
    lots: dict[int, list[Lot]] = {}
    draws: dict[int, list[Draw]] = {}
    for entry in entries:
        order = entry_order(entry)
        if entry.grams.is_positive:
            lots.setdefault(entry.variety_id, []).append(
                Lot(order, entry.variety_id, entry.grams, entry.total_cost)
            )
        else:
            draws.setdefault(entry.variety_id, []).append(
                Draw(order, entry.variety_id, Grams(-entry.grams.hundredths))
            )
    for sale_draw in sale_draws:
        draws.setdefault(sale_draw.variety_id, []).append(
            Draw(sale_draw_order(sale_draw), sale_draw.variety_id, sale_draw.grams)
        )
    varieties = set(lots) | set(draws)
    return {
        variety_id: (
            sorted(lots.get(variety_id, []), key=lambda lot: lot.order),
            sorted(draws.get(variety_id, []), key=lambda draw: draw.order),
        )
        for variety_id in varieties
    }
