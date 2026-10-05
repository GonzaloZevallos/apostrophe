"""Results' own arithmetic (docs/product/results.md: "Figures per period"; PRD
criterion 3). Pure, no infrastructure: `average_sale` rounds half up to the whole peso
and is `None` with no sales, never a `0`.

`profit` and `cash` used to live here as a second sum of the panel's own figures; GH-70
deleted them (ADR-0013 amendment) — Ganancia and Caja now come from
`period_figures.scan`/`totals_between`, the one computation `GET /analysis` already
used, so the two screens can no longer disagree."""

from __future__ import annotations


def average_sale(total: int, count: int) -> int | None:
    """`None` when `count` is 0 (PRD: "Average sale shows nothing when the period has
    no sales"), otherwise `total / count` rounded half up to the whole peso, via
    integer arithmetic only: `(2*total + count) // (2*count)`."""
    if count == 0:
        return None
    return (2 * total + count) // (2 * count)
