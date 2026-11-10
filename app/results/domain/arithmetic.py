"""Results' own arithmetic (docs/product/results.md: "Cifras por período"; PRD
criterion 3). Pure, no infrastructure: `average_sale` rounds half up to the whole peso
and is `None` with no sales, never a `0`.

`profit` and `cash` used to live here as a second sum of the panel's own figures; GH-70
deleted them (ADR-0013 amendment) — Ganancia and Caja now come from
`period_figures.scan`/`totals_between`, the one computation `GET /analysis` already
used, so the two screens can no longer disagree."""

from __future__ import annotations

from fractions import Fraction

from app.shared.money import round_half_up_to_units


def average_sale(total: int, count: int) -> int | None:
    """`None` when `count` is 0 (PRD: "Average sale shows nothing when the period has
    no sales"), otherwise `total / count` rounded half up to the whole peso
    through `round_half_up_to_units`."""
    if count == 0:
        return None
    return round_half_up_to_units(Fraction(total, count))
