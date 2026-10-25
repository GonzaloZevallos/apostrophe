"""List and read sales, labelled with what a screen needs (docs/adr/0011); nothing
here writes."""

from collections.abc import Sequence
from dataclasses import dataclass
from datetime import date

from app.sales.application.errors import SaleNotFound
from app.sales.application.ports import LineCost, LineCosts, OwingSales, SaleView, SaleViews


def get_sale(views: SaleViews, sale_id: int) -> SaleView:
    view = views.get_view(sale_id)
    if view is None:
        raise SaleNotFound()
    return view


@dataclass(frozen=True)
class SaleDetail:
    """What `GET /sales/{id}` shows: the labelled sale, each line's cost of goods and
    whether settlement still shows it as owed."""

    view: SaleView
    costs: list[LineCost]
    still_owing: bool


def get_sale_detail(
    views: SaleViews, line_costs: LineCosts, owing_sales: OwingSales, sale_id: int
) -> SaleDetail:
    """`GET /sales/{id}`'s own read (ADR-0009): the labelled sale together with each
    line's cost of goods, allocated fresh from the stock lots as they stand now, and
    its `still_owing` from one `settlement_of` read — none for a sale without a
    customer, which settlement never sees."""
    view = get_sale(views, sale_id)
    costs = line_costs.for_sale(view.sale)
    still_owing = False
    if view.customer is not None:
        assert view.sale.id is not None, "only a stored sale is read"
        settlement = owing_sales.settlement_of(view.customer.id)
        still_owing = settlement.still_owed.get(view.sale.id, 0) > 0
    return SaleDetail(view, costs, still_owing)


def list_sales(
    views: SaleViews, date_from: date | None, date_to: date | None
) -> Sequence[SaleView]:
    return views.list_views(date_from, date_to)
