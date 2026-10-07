"""Lot order: the one order lots and draws are ever read in (CONTEXT.md: Lot, Draw,
Lot order; ADR-0009).

A stock entry is a `Lot` when its grams are positive, a `Draw` when they are not (a
negative adjustment); a sale line (gifts included) and a stock withdrawal's line are
always a `Draw`. Every draw carries its `DrawSource` (ADR-0031). Both carry a
`LotOrder`: date first, then recording order — a stock entry's `recorded_at`, a sale
line's own, a withdrawal's own — with `rank` telling the three sources apart so an exact
tie never depends on which table happened to be read first: a negative adjustment, then
a sale line, then a withdrawal line (by `position`). `lots_and_draws` is the one place a
variety's lots and draws are assembled, grouped and sorted, and `history()` its one
caller; `allocate` and `stock_level` both read its answer, never SQL and never a
grouping of their own.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime

from app.shared.grams import Grams
from app.stock.domain.draw_source import DrawSource, WithdrawalReason, draw_source_of
from app.stock.domain.entry import StockEntry

STOCK_ENTRY_RANK = 0
SALE_LINE_RANK = 1
WITHDRAWAL_LINE_RANK = 2


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
    """Grams going out of a variety: a sale line (gifts included), a negative
    adjustment or a stock withdrawal's line, always carried as a positive magnitude —
    the direction is already `Draw` itself, never a signed `Grams`. `source` says which
    of them, and is the only way a draw's kind is told.

    `sale_id`, `line_total`, `pricing_rule` and `variety_name` ride along from the
    `SaleLineDraw` a sale-line draw was built from (a negative-adjustment draw leaves
    them at their defaults, as does a withdrawal-line draw), so results' own `DrawCosts`
    (ADR-0020) reads them off this exact draw once `allocate` has costed it, never by
    joining a line to its cost through `(sale_id, position)` afterwards. `allocate` and
    `stock_level` never read them."""

    order: LotOrder
    variety_id: int
    grams: Grams
    source: DrawSource
    sale_id: int | None = None
    line_total: int | None = None
    pricing_rule: str | None = None
    variety_name: str | None = None

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
    `DrawCosts` (ADR-0020) needs them matched to this exact draw, never joined back by
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


@dataclass(frozen=True)
class WithdrawalLineDraw:
    """One stock withdrawal line's draw on its variety's stock: the shape the
    withdrawal reader answers, beside `SaleLineDraw`, so this module never imports
    anything outside `app/stock/`. `withdrawal_id` is the line's `ref_id` in its
    `LotOrder`, `day` the withdrawal's date, `recorded_at` its own (an edit never
    changes it), `reason` what decides the draw's source."""

    variety_id: int
    day: date
    recorded_at: datetime
    withdrawal_id: int
    position: int
    grams: Grams
    reason: WithdrawalReason


def _entry_order(entry: StockEntry) -> LotOrder:
    assert entry.id is not None, "only a stored entry is ordered"
    return LotOrder(entry.entry_date, entry.recorded_at, STOCK_ENTRY_RANK, entry.id, 0)


def _sale_draw_order(draw: SaleLineDraw) -> LotOrder:
    return LotOrder(draw.day, draw.recorded_at, SALE_LINE_RANK, draw.sale_id, draw.position)


def _withdrawal_draw_order(draw: WithdrawalLineDraw) -> LotOrder:
    return LotOrder(
        draw.day, draw.recorded_at, WITHDRAWAL_LINE_RANK, draw.withdrawal_id, draw.position
    )


def lots_and_draws(
    entries: list[StockEntry],
    sale_draws: list[SaleLineDraw],
    withdrawal_draws: list[WithdrawalLineDraw],
) -> dict[int, tuple[list[Lot], list[Draw]]]:
    """Groups entries, sale-line draws and withdrawal-line draws by variety, each
    group's lots and its draws sorted by `LotOrder`. A variety with nothing at all is
    simply absent. `withdrawal_draws` has no default: a caller that forgets a source
    does not compile (called only from `history()`)."""
    lots: dict[int, list[Lot]] = {}
    draws: dict[int, list[Draw]] = {}
    for entry in entries:
        order = _entry_order(entry)
        if entry.grams.is_positive:
            lots.setdefault(entry.variety_id, []).append(
                Lot(order, entry.variety_id, entry.grams, entry.total_cost)
            )
        else:
            draws.setdefault(entry.variety_id, []).append(
                Draw(
                    order,
                    entry.variety_id,
                    Grams(-entry.grams.hundredths),
                    DrawSource.ADJUSTMENT,
                )
            )
    for sale_draw in sale_draws:
        draws.setdefault(sale_draw.variety_id, []).append(
            Draw(
                _sale_draw_order(sale_draw),
                sale_draw.variety_id,
                sale_draw.grams,
                DrawSource.SALE_LINE,
                sale_id=sale_draw.sale_id,
                line_total=sale_draw.line_total,
                pricing_rule=sale_draw.pricing_rule,
                variety_name=sale_draw.variety_name,
            )
        )
    for withdrawal_draw in withdrawal_draws:
        draws.setdefault(withdrawal_draw.variety_id, []).append(
            Draw(
                _withdrawal_draw_order(withdrawal_draw),
                withdrawal_draw.variety_id,
                withdrawal_draw.grams,
                draw_source_of(withdrawal_draw.reason),
            )
        )
    varieties = set(lots) | set(draws)
    return {
        variety_id: (
            sorted(lots.get(variety_id, []), key=lambda lot: lot.order),
            sorted(draws.get(variety_id, []), key=lambda draw: draw.order),
        )
        for variety_id in varieties
    }
