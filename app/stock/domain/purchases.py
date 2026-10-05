"""A period's flower purchases (CONTEXT.md: Purchase; PRD: "Compras de flores"): the
total cost of the period's purchase stock entries, each counted on its own date.
"""

from __future__ import annotations

from datetime import date

from app.stock.domain.entry import Origin, StockEntry


def purchases_in(entries: list[StockEntry], start: date, end: date) -> int:
    """Sums `total_cost` over every purchase entry dated in `[start, end]`. A purchase
    always carries a positive `total_cost` (`StockEntry.of`'s own rule); `or 0` only
    satisfies the type checker, it never actually substitutes a value here."""
    return sum(
        entry.total_cost or 0
        for entry in entries
        if entry.origin is Origin.PURCHASE and start <= entry.entry_date <= end
    )
