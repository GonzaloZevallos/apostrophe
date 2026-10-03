"""List and read sales; nothing here writes."""

from datetime import date

from app.sales.application.errors import SaleNotFound
from app.sales.application.ports import LineCost, LineCosts, Sales
from app.sales.domain.sale import Sale


def get_sale(sales: Sales, sale_id: int) -> Sale:
    sale = sales.get(sale_id)
    if sale is None:
        raise SaleNotFound()
    return sale


def get_sale_detail(
    sales: Sales, line_costs: LineCosts, sale_id: int
) -> tuple[Sale, list[LineCost]]:
    """`GET /sales/{id}`'s own read (ADR-0009): the sale together with each line's cost
    of goods, allocated fresh from the stock lots as they stand now."""
    sale = get_sale(sales, sale_id)
    return sale, line_costs.for_sale(sale)


def list_sales(sales: Sales, date_from: date | None, date_to: date | None) -> list[Sale]:
    return sales.list(date_from, date_to)
