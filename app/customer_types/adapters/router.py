from collections.abc import Callable
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.accounts.adapters.deps import CurrentBusinessId
from app.customer_types.adapters.schemas import (
    CustomerTypeIn,
    CustomerTypeOut,
    CustomerTypePatchIn,
)
from app.customer_types.adapters.sql_customer_types import SqlCustomerTypes
from app.customer_types.application import manage_customer_types
from app.customer_types.application.ports import CustomersInType
from app.customer_types.domain.customer_type import (
    CustomerTypeInUse,
    CustomerTypeNotFound,
    CustomerTypeRuleBroken,
    NameTaken,
)
from app.db import get_session
from app.http_errors import TranslateErrors

SessionDep = Annotated[Session, Depends(get_session)]

as_http = TranslateErrors(
    [
        (404, (CustomerTypeNotFound,)),
        (409, (NameTaken, CustomerTypeInUse)),
        (422, (CustomerTypeRuleBroken,)),
    ]
)


def get_customer_types(session: SessionDep, business_id: CurrentBusinessId) -> SqlCustomerTypes:
    return SqlCustomerTypes(session, business_id)


CustomerTypesDep = Annotated[SqlCustomerTypes, Depends(get_customer_types)]


def build_router(
    customers_in_type: Callable[[Session, int], CustomersInType],
) -> APIRouter:
    """The router of customer types. The count of customers in a type belongs to
    `customers`, which this hexagon never imports: `app.main` hands the provider in. No
    route here reads the pricing switches; the types answer the same with them on or off."""
    router = APIRouter(prefix="/api/customer-types", tags=["customer-types"])

    def get_customers_in_type(
        session: SessionDep, business_id: CurrentBusinessId
    ) -> CustomersInType:
        return customers_in_type(session, business_id)

    CustomersDep = Annotated[CustomersInType, Depends(get_customers_in_type)]

    @router.get("")
    def list_customer_types(types: CustomerTypesDep) -> list[CustomerTypeOut]:
        return [CustomerTypeOut.of(t) for t in manage_customer_types.list_customer_types(types)]

    @router.post("", status_code=201)
    def add_customer_type(
        body: CustomerTypeIn, types: CustomerTypesDep, session: SessionDep
    ) -> CustomerTypeOut:
        with as_http:
            created = manage_customer_types.create_customer_type(
                types, session, body.name, body.icon
            )
            return CustomerTypeOut.of(created)

    @router.patch("/{type_id}")
    def edit_customer_type(
        type_id: int, body: CustomerTypePatchIn, types: CustomerTypesDep, session: SessionDep
    ) -> CustomerTypeOut:
        with as_http:
            stored = manage_customer_types.edit_customer_type(
                types, session, type_id, body.name, body.icon
            )
            return CustomerTypeOut.of(stored)

    @router.delete("/{type_id}", status_code=204)
    def remove_customer_type(
        type_id: int,
        types: CustomerTypesDep,
        customers: CustomersDep,
        session: SessionDep,
    ) -> None:
        with as_http:
            manage_customer_types.delete_customer_type(types, customers, session, type_id)

    return router
