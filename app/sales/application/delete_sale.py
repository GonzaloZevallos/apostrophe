"""Delete a sale: a hard delete, its lines and payment with it. Its grams return to
stock (PRD "Deleting a sale returns its grams to stock"): summed per variety from the
sale's own lines, never read back from stock itself, since a hard delete needs nothing
from `app.stock` to say what it gave back."""

from dataclasses import dataclass

from app.sales.application.errors import SaleNotFound
from app.sales.application.ports import Sales
from app.shared.grams import Grams
from app.shared.transaction import Transaction


@dataclass(frozen=True)
class ReturnedGrams:
    """Grams a deleted sale gives back to one variety's stock."""

    variety_id: int
    grams: Grams


def delete_sale(sales: Sales, transaction: Transaction, sale_id: int) -> list[ReturnedGrams]:
    sale = sales.get(sale_id)
    if sale is None:
        raise SaleNotFound()

    totals: dict[int, Grams] = {}
    for line in sale.lines:
        totals[line.variety_id] = totals.get(line.variety_id, Grams(0)) + line.grams

    sales.delete(sale_id)
    transaction.commit()

    return [ReturnedGrams(variety_id, totals[variety_id]) for variety_id in sorted(totals)]
