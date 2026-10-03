from collections.abc import Callable
from typing import Annotated, cast

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.accounts.adapters.deps import CurrentBusinessId
from app.customers.adapters.schemas import NO_BALANCE, CustomerIn, CustomerOut, CustomerPatchIn
from app.customers.adapters.sql_customers import SqlCustomers
from app.customers.application import manage_customers
from app.customers.application.errors import CustomerNotFound, PhoneTaken, RequiredFieldCleared
from app.customers.application.ports import Balances
from app.customers.domain.customer import Customer, CustomerRuleBroken
from app.db import get_session
from app.http_errors import TranslateErrors

router = APIRouter(prefix="/customers", tags=["customers"])


SessionDep = Annotated[Session, Depends(get_session)]


def get_customers(session: SessionDep, business_id: CurrentBusinessId) -> SqlCustomers:
    return SqlCustomers(session, business_id)


def get_balances(
    request: Request, session: SessionDep, business_id: CurrentBusinessId
) -> Balances:
    # Customers never imports `app.payments` (CODING_STANDARDS section 1): `app/main.py`
    # hangs the real implementation (`SqlBalances`) on `app.state.balances` as a
    # factory, the same shape `get_line_costs` uses for `line_costs` in sales.
    factory = cast(Callable[[Session, int], Balances], request.app.state.balances)
    return factory(session, business_id)


CustomersDep = Annotated[SqlCustomers, Depends(get_customers)]
BalancesDep = Annotated[Balances, Depends(get_balances)]


def _out(customer: Customer, balances: Balances) -> CustomerOut:
    assert customer.id is not None, "only stored customers go out"
    balance = balances.for_customers([customer.id]).get(customer.id, NO_BALANCE)
    return CustomerOut.of(customer, balance)


as_http = TranslateErrors(
    [
        (404, (CustomerNotFound,)),
        (409, (PhoneTaken,)),
        (422, (CustomerRuleBroken, RequiredFieldCleared)),
    ]
)


@router.get("")
def list_customers(
    customers: CustomersDep, balances: BalancesDep, q: str = ""
) -> list[CustomerOut]:
    found = manage_customers.find_customers(customers, q)
    by_id = balances.for_customers([c.id for c in found if c.id is not None])
    return [CustomerOut.of(c, by_id.get(c.id, NO_BALANCE)) for c in found if c.id is not None]


@router.post("", status_code=201)
def register_customer(
    body: CustomerIn, customers: CustomersDep, balances: BalancesDep, session: SessionDep
) -> CustomerOut:
    with as_http:
        customer = manage_customers.register_customer(
            customers,
            session,
            name=body.name,
            phone=body.phone,
            channel=body.channel,
            vip=body.vip,
        )
        return _out(customer, balances)


@router.get("/{customer_id}")
def get_customer(customer_id: int, customers: CustomersDep, balances: BalancesDep) -> CustomerOut:
    with as_http:
        return _out(manage_customers.get_customer(customers, customer_id), balances)


@router.patch("/{customer_id}")
def edit_customer(
    customer_id: int,
    body: CustomerPatchIn,
    customers: CustomersDep,
    balances: BalancesDep,
    session: SessionDep,
) -> CustomerOut:
    with as_http:
        # 404 first, before a `null` meant to clear a required field is even looked at.
        manage_customers.get_customer(customers, customer_id)
        changes = body.to_changes()
        customer = manage_customers.edit_customer(customers, session, customer_id, changes)
        return _out(customer, balances)
