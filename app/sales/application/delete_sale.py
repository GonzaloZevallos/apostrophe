"""Delete a sale: a hard delete, its lines and payment with it. Its grams return to
stock (PRD "Deleting a sale returns its grams to stock"): summed per variety from the
sale's own lines, never read back from stock itself, since a hard delete needs nothing
from `app.stock` to say what it gave back."""

from dataclasses import dataclass

from app.sales.application.errors import SaleNotFound
from app.sales.application.ports import Sales
from app.shared.quantity import Quantity
from app.shared.transaction import Transaction


@dataclass(frozen=True)
class ReturnedQuantity:
    """Quantity a deleted sale gives back to one variety's stock."""

    variety_id: int
    quantity: Quantity


def delete_sale(sales: Sales, transaction: Transaction, sale_id: int) -> list[ReturnedQuantity]:
    sale = sales.get(sale_id)
    if sale is None:
        raise SaleNotFound()

    totals: dict[int, Quantity] = {}
    for line in sale.lines:
        totals[line.variety_id] = totals.get(line.variety_id, Quantity(0)) + line.quantity

    sales.delete(sale_id)
    transaction.commit()

    return [ReturnedQuantity(variety_id, totals[variety_id]) for variety_id in sorted(totals)]
