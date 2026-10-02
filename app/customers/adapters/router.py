from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.accounts.adapters.deps import CurrentBusinessId
from app.customers.adapters.schemas import CustomerIn, CustomerOut, CustomerPatchIn
from app.customers.adapters.sql_customers import SqlCustomers
from app.customers.application import manage_customers
from app.customers.application.errors import CustomerNotFound, PhoneTaken, RequiredFieldCleared
from app.customers.domain.customer import CustomerRuleBroken
from app.db import get_session
from app.http_errors import TranslateErrors

router = APIRouter(prefix="/customers", tags=["customers"])


SessionDep = Annotated[Session, Depends(get_session)]


def get_customers(session: SessionDep, business_id: CurrentBusinessId) -> SqlCustomers:
    return SqlCustomers(session, business_id)


CustomersDep = Annotated[SqlCustomers, Depends(get_customers)]


as_http = TranslateErrors(
    [
        (404, (CustomerNotFound,)),
        (409, (PhoneTaken,)),
        (422, (CustomerRuleBroken, RequiredFieldCleared)),
    ]
)


@router.get("")
def list_customers(customers: CustomersDep, q: str = "") -> list[CustomerOut]:
    return [CustomerOut.of(c) for c in manage_customers.find_customers(customers, q)]


@router.post("", status_code=201)
def register_customer(
    body: CustomerIn, customers: CustomersDep, session: SessionDep
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
        return CustomerOut.of(customer)


@router.get("/{customer_id}")
def get_customer(customer_id: int, customers: CustomersDep) -> CustomerOut:
    with as_http:
        return CustomerOut.of(manage_customers.get_customer(customers, customer_id))


@router.patch("/{customer_id}")
def edit_customer(
    customer_id: int,
    body: CustomerPatchIn,
    customers: CustomersDep,
    session: SessionDep,
) -> CustomerOut:
    with as_http:
        # 404 first, before a `null` meant to clear a required field is even looked at.
        manage_customers.get_customer(customers, customer_id)
        changes = body.to_changes()
        customer = manage_customers.edit_customer(customers, session, customer_id, changes)
        return CustomerOut.of(customer)
