"""List and read sales, labelled with what a screen needs (docs/adr/0011); nothing
here writes."""

from collections.abc import Sequence
from datetime import date

from app.sales.application.errors import SaleNotFound
from app.sales.application.ports import LineCost, LineCosts, SaleView, SaleViews


def get_sale(views: SaleViews, sale_id: int) -> SaleView:
    view = views.get_view(sale_id)
    if view is None:
        raise SaleNotFound()
    return view


def get_sale_detail(
    views: SaleViews, line_costs: LineCosts, sale_id: int
) -> tuple[SaleView, list[LineCost]]:
    """`GET /sales/{id}`'s own read (ADR-0009): the labelled sale together with each
    line's cost of goods, allocated fresh from the stock lots as they stand now."""
    view = get_sale(views, sale_id)
    return view, line_costs.for_sale(view.sale)


def list_sales(
    views: SaleViews, date_from: date | None, date_to: date | None
) -> Sequence[SaleView]:
    return views.list_views(date_from, date_to)
