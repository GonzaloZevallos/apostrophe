from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.accounts.adapters.deps import CurrentBusinessId
from app.clock import Clock, get_clock, get_today
from app.db import get_session
from app.http_errors import TranslateErrors
from app.sales.adapters.customer_facts import SqlCustomerFacts
from app.sales.adapters.price_book import SqlPriceBook
from app.sales.adapters.schemas import AssignCustomerIn, LineIn, SaleIn, SaleOut
from app.sales.adapters.sql_sales import SqlSales
from app.sales.application import view_sales
from app.sales.application.assign_customer import assign_customer as assign_customer_use_case
from app.sales.application.delete_sale import delete_sale as delete_sale_use_case
from app.sales.application.errors import SaleNotFound
from app.sales.application.record_sale import LineInput
from app.sales.application.record_sale import record_sale as record_sale_use_case
from app.sales.domain.pricing import SaleRuleBroken
from app.sales.domain.sale import CustomerAlreadyAssigned, PaymentMethod
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


SalesDep = Annotated[SqlSales, Depends(get_sales)]
PriceBookDep = Annotated[SqlPriceBook, Depends(get_price_book)]
CustomerFactsDep = Annotated[SqlCustomerFacts, Depends(get_customer_facts)]


as_http = TranslateErrors(
    [
        (404, (SaleNotFound,)),
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
            session,
            sale_date=body.date or today,
            today=today,
            customer_id=body.customer_id,
            shipping_charged=body.shipping_charged,
            note=body.note,
            lines=[_line_input(line) for line in body.lines],
            method=method,
            left_owing=method is None,
            recorded_at=clock(),
        )
        return SaleOut.of(sale)


@router.get("")
def list_sales(
    sales: SalesDep, date_from: date | None = None, date_to: date | None = None
) -> list[SaleOut]:
    return [SaleOut.of(sale) for sale in view_sales.list_sales(sales, date_from, date_to)]


@router.get("/{sale_id}")
def get_sale(sale_id: int, sales: SalesDep) -> SaleOut:
    with as_http:
        return SaleOut.of(view_sales.get_sale(sales, sale_id))


@router.put("/{sale_id}/customer")
def assign_customer(
    sale_id: int,
    body: AssignCustomerIn,
    sales: SalesDep,
    customer_facts: CustomerFactsDep,
    session: SessionDep,
) -> SaleOut:
    with as_http:
        sale = assign_customer_use_case(sales, customer_facts, session, sale_id, body.customer_id)
        return SaleOut.of(sale)


@router.delete("/{sale_id}", status_code=204)
def delete_sale(sale_id: int, sales: SalesDep, session: SessionDep) -> None:
    with as_http:
        delete_sale_use_case(sales, session, sale_id)
