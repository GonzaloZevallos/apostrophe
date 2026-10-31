"""The unit check every stock use case that records a quantity runs (docs/adr/0055,
0056): `Unit.admits` through stock's own `UnitsReader` port, once before the first write
and once after it and before the commit, so a unit that lost decimals in between still
refuses and the write is undone. Nothing is ever rounded or truncated."""

from __future__ import annotations

from collections.abc import Sequence

from app.shared.quantity import Quantity, TooManyDecimals
from app.shared.transaction import Transaction
from app.stock.application.errors import VarietyNotFound
from app.stock.application.ports import UnitsReader

# A quantity to check, with the product it is recorded against.
Checked = tuple[int, Quantity]


def require_admitted(units: UnitsReader, checked: Sequence[Checked]) -> None:
    """The check before any write. A product with no unit to read was deleted since the
    caller found it: that is the same "not found" the catalog answers, not a refusal of
    the quantity."""
    by_product = units.units_of({product_id for product_id, _ in checked})
    if any(product_id not in by_product for product_id, _ in checked):
        raise VarietyNotFound()
    if not all(by_product[product_id].admits(quantity) for product_id, quantity in checked):
        raise TooManyDecimals()


def confirm_admitted(
    units: UnitsReader, transaction: Transaction, checked: Sequence[Checked]
) -> None:
    """The check after the write and before the commit: the unit may have lost decimals
    since the first read. On a refusal everything is rolled back, then the refusal is
    raised; on success the caller commits."""
    by_product = units.units_of({product_id for product_id, _ in checked})
    if not all(by_product[product_id].admits(quantity) for product_id, quantity in checked):
        transaction.rollback()
        raise TooManyDecimals()
