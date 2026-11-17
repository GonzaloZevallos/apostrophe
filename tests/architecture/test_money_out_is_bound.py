"""Every route that answers a `MoneyOut` amount binds the business's decimals first.

A domain amount is an int in the unit of the business's decimals and `MoneyOut` writes it in
currency units with `MONEY_DECIMALS` (docs/architecture/modelo-de-datos.md). A router
included without `bind_money_decimals` would leave the variable at 0, and a business that
shows 2 decimals would see every amount 100 times too large.
"""

from __future__ import annotations

from typing import Annotated, Any, get_args, get_origin

from fastapi import Depends, FastAPI
from fastapi.dependencies.models import Dependant
from fastapi.routing import APIRoute
from pydantic import BaseModel

from app.money_context import bind_money_decimals
from app.money_schema import MoneyOut

_MARKS: tuple[Any, ...] = get_args(MoneyOut)[1:]


def _carries_money_out(annotation: Any, seen: set[type]) -> bool:
    """Whether a response annotation holds a `MoneyOut` field, however deeply nested."""
    if isinstance(annotation, type) and issubclass(annotation, BaseModel):
        if annotation in seen:
            return False
        seen.add(annotation)
        return any(
            any(mark in field.metadata for mark in _MARKS)
            or _carries_money_out(field.annotation, seen)
            for field in annotation.model_fields.values()
        )
    if get_origin(annotation) is Annotated:
        return any(mark in get_args(annotation) for mark in _MARKS)
    return any(_carries_money_out(argument, seen) for argument in get_args(annotation))


def _depends_on(dependant: Dependant, call: Any) -> bool:
    return dependant.call is call or any(_depends_on(sub, call) for sub in dependant.dependencies)


def unbound_money_routes(app: FastAPI) -> list[str]:
    """`METHOD path` of each route whose answer carries a `MoneyOut` and that does not
    depend on `bind_money_decimals`."""
    found: list[str] = []
    for route in app.routes:
        if not isinstance(route, APIRoute) or route.response_model is None:
            continue
        if _carries_money_out(route.response_model, set()) and not _depends_on(
            route.dependant, bind_money_decimals
        ):
            found.append(f"{sorted(route.methods or ())[0]} {route.path}")
    return found


class _Amount(BaseModel):
    amount: MoneyOut


def test_every_route_that_answers_an_amount_binds_the_businesss_decimals(app: FastAPI) -> None:
    assert unbound_money_routes(app) == []


def test_a_route_that_answers_an_amount_without_the_binding_is_found() -> None:
    probe = FastAPI()

    @probe.get("/bare", response_model=list[_Amount])
    def bare() -> list[_Amount]:
        return []

    @probe.get("/bound", response_model=list[_Amount], dependencies=[Depends(bind_money_decimals)])
    def bound() -> list[_Amount]:
        return []

    assert unbound_money_routes(probe) == ["GET /bare"]
