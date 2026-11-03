from collections.abc import Callable
from typing import Annotated, cast

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.accounts.adapters.deps import CurrentBusinessId
from app.customer_types.adapters.refusals import TYPE_NOT_FOUND_CODE
from app.customers.adapters.customer_type_lookup import SqlCustomerTypeLookup
from app.customers.adapters.schemas import NO_BALANCE, CustomerIn, CustomerOut, CustomerPatchIn
from app.customers.adapters.sql_customers import SqlCustomers
from app.customers.application import manage_customers
from app.customers.application.errors import (
    CustomerNotFound,
    CustomerTypeNotFound,
    PhoneTaken,
    RequiredFieldCleared,
)
from app.customers.application.ports import Balances, PricingSettingsReader
from app.customers.domain.customer import Customer, CustomerRuleBroken
from app.db import get_session
from app.http_errors import Refused, TranslateErrors

router = APIRouter(prefix="/customers", tags=["customers"])


SessionDep = Annotated[Session, Depends(get_session)]


def get_customer_types(
    session: SessionDep, business_id: CurrentBusinessId
) -> SqlCustomerTypeLookup:
    # One per request (FastAPI caches the dependency): the VIP type id is read once and
    # shared by the use cases and the answers.
    return SqlCustomerTypeLookup(session, business_id)


CustomerTypesDep = Annotated[SqlCustomerTypeLookup, Depends(get_customer_types)]


def get_customers(session: SessionDep, business_id: CurrentBusinessId) -> SqlCustomers:
    return SqlCustomers(session, business_id)


def get_balances(request: Request, session: SessionDep, business_id: CurrentBusinessId) -> Balances:
    # Customers never imports `app.payments` (CODING_STANDARDS section 1): `app/main.py`
    # hangs the real implementation (`SqlBalances`) on `app.state.balances` as a
    # factory, the same shape `get_line_costs` uses for `line_costs` in sales.
    factory = cast(Callable[[Session, int], Balances], request.app.state.balances)
    return factory(session, business_id)


def get_pricing_settings(
    request: Request, session: SessionDep, business_id: CurrentBusinessId
) -> PricingSettingsReader:
    # Customers never imports `app.pricing_settings`: `app/main.py` hangs the real reader
    # on `app.state` as a `(Session, business_id)` factory (docs/adr/0006).
    factory = cast(
        Callable[[Session, int], PricingSettingsReader],
        request.app.state.customers_pricing_settings,
    )
    return factory(session, business_id)


CustomersDep = Annotated[SqlCustomers, Depends(get_customers)]
BalancesDep = Annotated[Balances, Depends(get_balances)]
SettingsDep = Annotated[PricingSettingsReader, Depends(get_pricing_settings)]


def _out(customer: Customer, balances: Balances, types: SqlCustomerTypeLookup) -> CustomerOut:
    assert customer.id is not None, "only stored customers go out"
    balance = balances.for_customers([customer.id]).get(customer.id, NO_BALANCE)
    return CustomerOut.of(customer, balance, types.vip_type_id())


as_http = TranslateErrors(
    [
        (404, (CustomerNotFound,)),
        (409, (PhoneTaken,)),
        (422, (CustomerRuleBroken, RequiredFieldCleared)),
    ]
)


def _type_not_found() -> Refused:
    """The 404 for a type that is not this business's, with the code `customer_types`
    owns for it (the use case's own error carries none)."""
    return Refused(404, "no such customer type", TYPE_NOT_FOUND_CODE)


@router.get("")
def list_customers(
    customers: CustomersDep, balances: BalancesDep, types: CustomerTypesDep, q: str = ""
) -> list[CustomerOut]:
    found = manage_customers.find_customers(customers, q)
    by_id = balances.for_customers([c.id for c in found if c.id is not None])
    vip_type_id = types.vip_type_id()
    return [
        CustomerOut.of(c, by_id.get(c.id, NO_BALANCE), vip_type_id)
        for c in found
        if c.id is not None
    ]


@router.post("", status_code=201)
def register_customer(
    body: CustomerIn,
    customers: CustomersDep,
    settings: SettingsDep,
    types: CustomerTypesDep,
    balances: BalancesDep,
    session: SessionDep,
) -> CustomerOut:
    with as_http:
        try:
            customer = manage_customers.register_customer(
                customers,
                settings,
                types,
                session,
                name=body.name,
                phone=body.phone,
                customer_type_id=body.customer_type_id,
            )
        except CustomerTypeNotFound:
            raise _type_not_found() from None
        return _out(customer, balances, types)


@router.get("/{customer_id}")
def get_customer(
    customer_id: int, customers: CustomersDep, balances: BalancesDep, types: CustomerTypesDep
) -> CustomerOut:
    with as_http:
        return _out(manage_customers.get_customer(customers, customer_id), balances, types)


@router.patch("/{customer_id}")
def edit_customer(
    customer_id: int,
    body: CustomerPatchIn,
    customers: CustomersDep,
    settings: SettingsDep,
    types: CustomerTypesDep,
    balances: BalancesDep,
    session: SessionDep,
) -> CustomerOut:
    with as_http:
        # 404 first, before a `null` meant to clear a required field is even looked at.
        manage_customers.get_customer(customers, customer_id)
        changes = body.to_changes()
        try:
            customer = manage_customers.edit_customer(
                customers, settings, types, session, customer_id, changes
            )
        except CustomerTypeNotFound:
            raise _type_not_found() from None
        return _out(customer, balances, types)
