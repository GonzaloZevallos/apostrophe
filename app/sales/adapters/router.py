from collections.abc import Callable
from datetime import date
from typing import Annotated, cast

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.accounts.adapters.deps import CurrentBusinessId
from app.clock import Clock, get_clock, get_today
from app.db import get_session
from app.http_errors import TranslateErrors
from app.sales.adapters.customer_facts import SqlCustomerFacts
from app.sales.adapters.price_book import SqlPriceBook
from app.sales.adapters.schemas import (
    AssignCustomerIn,
    DeleteSaleOut,
    LineIn,
    ReturnedGramsOut,
    SaleDetailOut,
    SaleIn,
    SaleOut,
)
from app.sales.adapters.sql_sales import SqlSales
from app.sales.application import view_sales
from app.sales.application.assign_customer import assign_customer as assign_customer_use_case
from app.sales.application.delete_sale import delete_sale as delete_sale_use_case
from app.sales.application.errors import SaleNotFound
from app.sales.application.ports import (
    LineCosts,
    OwingSales,
    PricingSettingsReader,
    SaleView,
)
from app.sales.application.record_sale import LineInput
from app.sales.application.record_sale import record_sale as record_sale_use_case
from app.sales.domain.pricing import SaleRuleBroken
from app.sales.domain.sale import (
    CustomerAlreadyAssigned,
    PaymentMethod,
    UnknownCustomer,
    UnknownVariety,
)
from app.shared.grams import Grams, InvalidGrams

router = APIRouter(prefix="/sales", tags=["sales"])


SessionDep = Annotated[Session, Depends(get_session)]
TodayDep = Annotated[date, Depends(get_today)]
ClockDep = Annotated[Clock, Depends(get_clock)]


def get_sales(session: SessionDep, business_id: CurrentBusinessId) -> SqlSales:
    return SqlSales(session, business_id)


def get_price_book(session: SessionDep, business_id: CurrentBusinessId) -> SqlPriceBook:
    return SqlPriceBook(session, business_id)


def get_customer_facts(session: SessionDep, business_id: CurrentBusinessId) -> SqlCustomerFacts:
    return SqlCustomerFacts(session, business_id)


def get_line_costs(
    request: Request, session: SessionDep, business_id: CurrentBusinessId
) -> LineCosts:
    # Sales never imports `app.stock` (CODING_STANDARDS section 1): `app/main.py` hangs
    # the real implementation (`SqlLineCosts`) on `app.state.line_costs` as a factory,
    # the same shape `get_business_opening` uses for `business_opening`.
    factory = cast(Callable[[Session, int], LineCosts], request.app.state.line_costs)
    return factory(session, business_id)


SalesDep = Annotated[SqlSales, Depends(get_sales)]
PriceBookDep = Annotated[SqlPriceBook, Depends(get_price_book)]
CustomerFactsDep = Annotated[SqlCustomerFacts, Depends(get_customer_facts)]


def get_owing_sales(
    request: Request, session: SessionDep, business_id: CurrentBusinessId
) -> OwingSales:
    # Sales never imports `app.payments` (CODING_STANDARDS section 1): `app/main.py`
    # hangs the real implementation (`SqlOwingSales`) on `app.state.owing_sales` as a
    # factory, the same shape used for `line_costs`.
    factory = cast(Callable[[Session, int], OwingSales], request.app.state.owing_sales)
    return factory(session, business_id)


def get_pricing_settings(
    request: Request, session: SessionDep, business_id: CurrentBusinessId
) -> PricingSettingsReader:
    # Sales never imports `app.pricing_settings` (docs/adr/0031): `app/main.py` hangs
    # `SqlPricingSettings` on `app.state.pricing_settings` as a factory, the same shape
    # used for `line_costs`.
    factory = cast(
        Callable[[Session, int], PricingSettingsReader], request.app.state.pricing_settings
    )
    return factory(session, business_id)


LineCostsDep = Annotated[LineCosts, Depends(get_line_costs)]
PricingSettingsDep = Annotated[PricingSettingsReader, Depends(get_pricing_settings)]
OwingSalesDep = Annotated[OwingSales, Depends(get_owing_sales)]


as_http = TranslateErrors(
    [
        (404, (SaleNotFound, UnknownCustomer, UnknownVariety)),
        (409, (CustomerAlreadyAssigned,)),
        (422, (SaleRuleBroken, InvalidGrams)),
    ]
)


def _line_input(line: LineIn) -> LineInput:
    return LineInput(
        variety_id=line.variety_id,
        grams=Grams.of(line.grams),
        gift=line.gift,
        special_price=line.special_price,
    )


@router.post("", status_code=201)
def record_sale(
    body: SaleIn,
    sales: SalesDep,
    price_book: PriceBookDep,
    customer_facts: CustomerFactsDep,
    pricing_settings: PricingSettingsDep,
    owing_sales: OwingSalesDep,
    session: SessionDep,
    today: TodayDep,
    clock: ClockDep,
) -> SaleOut:
    with as_http:
        method = body.payment if isinstance(body.payment, PaymentMethod) else None
        sale = record_sale_use_case(
            sales,
            price_book,
            customer_facts,
            pricing_settings,
            session,
            sale_date=body.date or today,
            today=today,
            customer_id=body.customer_id,
            shipping_charged=body.shipping_charged,
            note=body.note,
            lines=[_line_input(line) for line in body.lines],
            method=method,
            left_owing=body.payment == "owing",
            recorded_at=clock(),
        )
        return _sale_out(sales, owing_sales, sale.id)


@router.get("")
def list_sales(
    sales: SalesDep,
    owing_sales: OwingSalesDep,
    date_from: date | None = None,
    date_to: date | None = None,
) -> list[SaleOut]:
    views = view_sales.list_sales(sales, date_from, date_to)
    customer_ids = [view.customer.id for view in views if view.customer is not None]
    owing = owing_sales.still_owing(customer_ids)
    return [SaleOut.of(view, view.sale.id in owing) for view in views]


@router.get("/{sale_id}")
def get_sale(
    sale_id: int, sales: SalesDep, line_costs: LineCostsDep, owing_sales: OwingSalesDep
) -> SaleDetailOut:
    with as_http:
        view, costs = view_sales.get_sale_detail(sales, line_costs, sale_id)
        still_owing = _still_owing(view, owing_sales)
        return SaleDetailOut.of(view, costs, still_owing)


@router.put("/{sale_id}/customer")
def assign_customer(
    sale_id: int,
    body: AssignCustomerIn,
    sales: SalesDep,
    customer_facts: CustomerFactsDep,
    owing_sales: OwingSalesDep,
    session: SessionDep,
) -> SaleOut:
    with as_http:
        sale = assign_customer_use_case(sales, customer_facts, session, sale_id, body.customer_id)
        return _sale_out(sales, owing_sales, sale.id)


def _view_of(sales: SqlSales, sale_id: int | None) -> SaleView:
    assert sale_id is not None, "only a stored sale is read back"
    view = sales.get_view(sale_id)
    assert view is not None, "the sale just written or updated still exists"
    return view


def _still_owing(view: SaleView, owing_sales: OwingSales) -> bool:
    # A sale with no customer never owes: settlement never sees one (the plan's
    # invariant), so there is nothing to ask the port about.
    if view.customer is None:
        return False
    return view.sale.id in owing_sales.still_owing([view.customer.id])


def _sale_out(sales: SqlSales, owing_sales: OwingSales, sale_id: int | None) -> SaleOut:
    view = _view_of(sales, sale_id)
    return SaleOut.of(view, _still_owing(view, owing_sales))


@router.delete("/{sale_id}", status_code=200)
def delete_sale(sale_id: int, sales: SalesDep, session: SessionDep) -> DeleteSaleOut:
    with as_http:
        returned = delete_sale_use_case(sales, session, sale_id)
        return DeleteSaleOut(
            returned=[
                ReturnedGramsOut(variety_id=r.variety_id, grams=r.grams.as_decimal())
                for r in returned
            ]
        )
