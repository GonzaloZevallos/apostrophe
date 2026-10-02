"""List and read sales; nothing here writes."""

from datetime import date

from app.sales.application.errors import SaleNotFound
from app.sales.application.ports import Sales
from app.sales.domain.sale import Sale


def get_sale(sales: Sales, sale_id: int) -> Sale:
    sale = sales.get(sale_id)
    if sale is None:
        raise SaleNotFound()
    return sale


def list_sales(sales: Sales, date_from: date | None, date_to: date | None) -> list[Sale]:
    return sales.list(date_from, date_to)
