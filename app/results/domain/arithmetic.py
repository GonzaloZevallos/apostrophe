"""Results' own arithmetic (docs/product/results.md: "Figures per period"; PRD
criterion 3). Pure, no infrastructure: `profit` and `cash` are each a plain
subtraction over figures the adapters already computed; `average_sale` rounds half up
to the whole peso and is `None` with no sales, never a `0`."""

from __future__ import annotations


def profit(sales: int, cost_of_goods: int, expenses: int) -> int:
    """Ganancia = sales − cost of goods sold − expenses. May be negative; never
    floored (PRD: "Negative figures")."""
    return sales - cost_of_goods - expenses


def cash(received: int, expenses: int, purchases: int) -> int:
    """Caja = payments received − expenses − purchases. May be negative; never
    floored (PRD: "Negative figures")."""
    return received - expenses - purchases


def average_sale(total: int, count: int) -> int | None:
    """`None` when `count` is 0 (PRD: "Average sale shows nothing when the period has
    no sales"), otherwise `total / count` rounded half up to the whole peso, via
    integer arithmetic only: `(2*total + count) // (2*count)`."""
    if count == 0:
        return None
    return (2 * total + count) // (2 * count)
