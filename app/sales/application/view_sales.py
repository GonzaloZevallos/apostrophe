"""List and read sales, labelled with what a screen needs (docs/adr/0009); nothing
here writes."""

from collections.abc import Sequence
from datetime import date

from app.sales.application.errors import SaleNotFound
from app.sales.application.ports import SaleView, SaleViews


def get_sale(views: SaleViews, sale_id: int) -> SaleView:
    view = views.get_view(sale_id)
    if view is None:
        raise SaleNotFound()
    return view


def list_sales(
    views: SaleViews, date_from: date | None, date_to: date | None
) -> Sequence[SaleView]:
    return views.list_views(date_from, date_to)
