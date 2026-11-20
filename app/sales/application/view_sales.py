"""List and read sales, labelled with what a screen needs (docs/adr/0011); nothing
here writes."""

from collections.abc import Mapping
from dataclasses import dataclass
from datetime import date

from app.sales.application.errors import SaleNotFound
from app.sales.application.ports import (
    BusinessNames,
    CustomerSettlement,
    LineCost,
    LineCosts,
    OwingSales,
    SaleView,
    SaleViews,
)
from app.sales.application.sale_bill import sale_bill_of, view_payment
from app.sales.domain.sale_bill import SaleBill, SalePayment


def get_sale(views: SaleViews, sale_id: int) -> SaleView:
    view = views.get_view(sale_id)
    if view is None:
        raise SaleNotFound()
    return view


@dataclass(frozen=True)
class SaleDetail:
    """What `GET /sales/{id}` shows: the labelled sale, each line's cost of goods,
    whether settlement still shows it as owed, its Payment state (`None` when its
    payment facts cannot be reconciled) and its sale bill (`None` in the same case)."""

    view: SaleView
    costs: list[LineCost]
    still_owing: bool
    payment: SalePayment | None
    bill: SaleBill | None


def get_sale_detail(
    views: SaleViews,
    line_costs: LineCosts,
    owing_sales: OwingSales,
    business_names: BusinessNames,
    sale_id: int,
) -> SaleDetail:
    """`GET /sales/{id}`'s own read (ADR-0009): the labelled sale together with each
    line's cost of goods, allocated fresh from the stock lots as they stand now, and
    its `still_owing`, its Payment state and its sale bill, all from one
    `settlement_of` read — none for a sale without a customer, which settlement never
    sees."""
    view = get_sale(views, sale_id)
    costs = line_costs.for_sale(view.sale)
    settlement = CustomerSettlement(0, {})
    if view.customer is not None:
        settlement = owing_sales.settlement_of(view.customer.id)
    listed = listed_sale(view, settlement.still_owed)
    bill = sale_bill_of(view, listed.payment, settlement.balance, business_names)
    return SaleDetail(view, costs, listed.still_owing, listed.payment, bill)


@dataclass(frozen=True)
class ListedSale:
    """A labelled sale with what settlement says of it: whether it is still owing
    (Sales still owing) and its Payment state, `None` when its payment facts cannot be
    reconciled."""

    view: SaleView
    still_owing: bool
    payment: SalePayment | None


def listed_sale(view: SaleView, owed: Mapping[int, int]) -> ListedSale:
    """`owed` is settlement's map for the sale's customer; both fields come from it."""
    still_owed = None if view.sale.id is None else owed.get(view.sale.id)
    return ListedSale(view, (still_owed or 0) > 0, view_payment(view, still_owed))


def read_sale(view: SaleView, owing_sales: OwingSales) -> ListedSale:
    """One sale read back after a write: one `settlement_of` read, none for a sale
    with no customer."""
    owed: Mapping[int, int] = {}
    if view.customer is not None:
        owed = owing_sales.settlement_of(view.customer.id).still_owed
    return listed_sale(view, owed)


def list_sales(
    views: SaleViews,
    owing_sales: OwingSales,
    date_from: date | None,
    date_to: date | None,
) -> list[ListedSale]:
    """The sales of a period, each with its Payment state, from one `owed_of` read for
    the listed customers; a sale whose facts cannot be reconciled carries `None`
    and the others are unaffected."""
    listed = views.list_views(date_from, date_to)
    customer_ids = [view.customer.id for view in listed if view.customer is not None]
    owed = owing_sales.owed_of(customer_ids)
    return [listed_sale(view, owed) for view in listed]
