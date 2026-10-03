"""Delete a sale: a hard delete, its lines and payment with it."""

from app.sales.application.errors import SaleNotFound
from app.sales.application.ports import Sales
from app.shared.transaction import Transaction


def delete_sale(sales: Sales, transaction: Transaction, sale_id: int) -> None:
    if sales.get(sale_id) is None:
        raise SaleNotFound()
    sales.delete(sale_id)
    transaction.commit()
