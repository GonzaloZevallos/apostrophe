from collections.abc import Callable
from datetime import datetime
from typing import Annotated, cast

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.accounts.adapters.deps import CurrentBusinessId
from app.clock import Clock, get_clock
from app.db import get_session
from app.http_errors import TranslateErrors
from app.payment_methods.adapters.schemas import MethodIn, MethodOut, MethodPatch, MoveIn
from app.payment_methods.adapters.sql_payment_methods import SqlPaymentMethods
from app.payment_methods.application import manage_methods
from app.payment_methods.application.ports import PaymentMethodUsage
from app.payment_methods.domain.errors import (
    InUse,
    LastOffered,
    NameTaken,
    NameTakenArchived,
    PaymentMethodNotFound,
    PaymentMethodRuleBroken,
)
from app.payment_methods.domain.method import PaymentMethod

router = APIRouter(prefix="/api/payment-methods", tags=["payment-methods"])

SessionDep = Annotated[Session, Depends(get_session)]
ClockDep = Annotated[Clock, Depends(get_clock)]


def get_methods(session: SessionDep, business_id: CurrentBusinessId) -> SqlPaymentMethods:
    return SqlPaymentMethods(session, business_id)


def get_usage(
    request: Request, session: SessionDep, business_id: CurrentBusinessId
) -> PaymentMethodUsage:
    # Payment methods never imports `app.payments` (docs/adr/0082): `app/main.py` hangs
    # the usage adapter on `app.state.payment_method_usage` as a factory.
    factory = cast(
        Callable[[Session, int], PaymentMethodUsage], request.app.state.payment_method_usage
    )
    return factory(session, business_id)


MethodsDep = Annotated[SqlPaymentMethods, Depends(get_methods)]
UsageDep = Annotated[PaymentMethodUsage, Depends(get_usage)]

as_http = TranslateErrors(
    [
        (404, (PaymentMethodNotFound,)),
        (409, (NameTaken, NameTakenArchived, LastOffered, InUse)),
        (422, (PaymentMethodRuleBroken,)),
    ]
)


def _out(methods: list[PaymentMethod], usage: PaymentMethodUsage) -> list[MethodOut]:
    used = manage_methods.in_use(usage, methods)
    return [MethodOut.of(method, method.id in used) for method in methods]


def _one(method: PaymentMethod, usage: PaymentMethodUsage) -> MethodOut:
    return _out([method], usage)[0]


@router.get("")
def list_offered(methods: MethodsDep, usage: UsageDep) -> list[MethodOut]:
    return _out(manage_methods.list_offered(methods), usage)


@router.get("/archived")
def list_archived(methods: MethodsDep, usage: UsageDep) -> list[MethodOut]:
    return _out(manage_methods.list_archived(methods), usage)


@router.post("", status_code=201)
def add_method(
    body: MethodIn, methods: MethodsDep, usage: UsageDep, session: SessionDep
) -> MethodOut:
    with as_http:
        return _one(manage_methods.add_method(methods, session, body.name, body.icon), usage)


@router.patch("/{method_id}")
def update_method(
    method_id: int, body: MethodPatch, methods: MethodsDep, usage: UsageDep, session: SessionDep
) -> MethodOut:
    with as_http:
        updated = manage_methods.update_method(methods, session, method_id, body.name, body.icon)
        return _one(updated, usage)


@router.post("/{method_id}/move")
def move_method(
    method_id: int, body: MoveIn, methods: MethodsDep, usage: UsageDep, session: SessionDep
) -> list[MethodOut]:
    with as_http:
        return _out(manage_methods.move_method(methods, session, method_id, body.direction), usage)


@router.post("/{method_id}/archive", status_code=204)
def archive_method(
    method_id: int, methods: MethodsDep, session: SessionDep, clock: ClockDep
) -> None:
    now: datetime = clock()
    with as_http:
        manage_methods.archive_method(methods, session, method_id, now)


@router.post("/{method_id}/restore", status_code=204)
def restore_method(method_id: int, methods: MethodsDep, session: SessionDep) -> None:
    with as_http:
        manage_methods.restore_method(methods, session, method_id)


@router.delete("/{method_id}", status_code=204)
def delete_method(
    method_id: int, methods: MethodsDep, usage: UsageDep, session: SessionDep
) -> None:
    with as_http:
        manage_methods.delete_method(methods, usage, session, method_id)
