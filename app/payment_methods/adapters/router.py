"""Settings → Business → Payment methods (docs/adr/0055, docs/adr/0076): the business's own
list. Every route is built for the request's business; a method of another business
answers 404 like one that does not exist."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.accounts.adapters.deps import CurrentBusinessId
from app.clock import Clock, get_clock
from app.db import get_session
from app.http_errors import TranslateErrors
from app.payment_methods.adapters.sql_payment_methods import SqlPaymentMethods
from app.payment_methods.application import manage_methods
from app.payment_methods.application.ports import Direction
from app.payment_methods.domain.method import (
    LastActivePaymentMethod,
    PaymentMethod,
    PaymentMethodIcon,
    PaymentMethodInUse,
    PaymentMethodNameTaken,
    PaymentMethodNotFound,
    PaymentMethodRuleBroken,
)

router = APIRouter(prefix="/api/payment-methods", tags=["payment-methods"])

SessionDep = Annotated[Session, Depends(get_session)]
ClockDep = Annotated[Clock, Depends(get_clock)]


def get_methods(session: SessionDep, business_id: CurrentBusinessId) -> SqlPaymentMethods:
    return SqlPaymentMethods(session, business_id)


MethodsDep = Annotated[SqlPaymentMethods, Depends(get_methods)]

as_http = TranslateErrors(
    [
        (404, (PaymentMethodNotFound,)),
        (409, (PaymentMethodInUse, LastActivePaymentMethod)),
        (422, (PaymentMethodRuleBroken, PaymentMethodNameTaken)),
    ]
)


class PaymentMethodIn(BaseModel):
    name: str
    icon: PaymentMethodIcon | None = None


class PaymentMethodPatch(BaseModel):
    name: str | None = None
    icon: PaymentMethodIcon | None = None


class MoveIn(BaseModel):
    direction: Direction


class PaymentMethodOut(BaseModel):
    id: int
    name: str
    icon: str
    position: int
    is_used: bool


def _out(methods: SqlPaymentMethods, method: PaymentMethod) -> PaymentMethodOut:
    assert method.id is not None, "only stored methods go out"
    return PaymentMethodOut(
        id=method.id,
        name=method.name.value,
        icon=method.icon.value,
        position=method.position,
        is_used=methods.is_used(method.id),
    )


def _listed(methods: SqlPaymentMethods) -> list[PaymentMethodOut]:
    return [_out(methods, m) for m in manage_methods.list_methods(methods)]


@router.get("")
def list_methods(methods: MethodsDep) -> list[PaymentMethodOut]:
    return _listed(methods)


@router.get("/archived")
def list_archived(methods: MethodsDep) -> list[PaymentMethodOut]:
    return [_out(methods, m) for m in manage_methods.list_archived_methods(methods)]


@router.post("", status_code=201)
def add_method(body: PaymentMethodIn, methods: MethodsDep, session: SessionDep) -> PaymentMethodOut:
    with as_http:
        added = manage_methods.add_method(
            methods, session, body.name, body.icon or PaymentMethodIcon.DEFAULT
        )
        return _out(methods, added)


@router.patch("/{method_id}")
def edit_method(
    method_id: int, body: PaymentMethodPatch, methods: MethodsDep, session: SessionDep
) -> PaymentMethodOut:
    with as_http:
        manage_methods.get_method(methods, method_id)
        current = manage_methods.get_method(methods, method_id)
        if body.name is not None:
            current = manage_methods.rename_method(methods, session, method_id, body.name)
        if body.icon is not None:
            current = manage_methods.change_icon(methods, session, method_id, body.icon)
        return _out(methods, current)


@router.post("/{method_id}/move")
def move_method(
    method_id: int, body: MoveIn, methods: MethodsDep, session: SessionDep
) -> list[PaymentMethodOut]:
    with as_http:
        manage_methods.move_method(methods, session, method_id, body.direction)
        return _listed(methods)


@router.post("/{method_id}/archive", status_code=204)
def archive_method(
    method_id: int, methods: MethodsDep, session: SessionDep, clock: ClockDep
) -> None:
    with as_http:
        manage_methods.archive_method(methods, session, method_id, clock())


@router.post("/{method_id}/restore", status_code=204)
def restore_method(method_id: int, methods: MethodsDep, session: SessionDep) -> None:
    with as_http:
        manage_methods.restore_method(methods, session, method_id)


@router.delete("/{method_id}", status_code=204)
def delete_method(method_id: int, methods: MethodsDep, session: SessionDep) -> None:
    with as_http:
        manage_methods.delete_method(methods, session, method_id)
