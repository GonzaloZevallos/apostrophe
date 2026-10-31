from collections.abc import Callable, Sequence
from typing import Annotated, cast

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.accounts.adapters.deps import CurrentBusinessId
from app.db import get_session
from app.http_errors import TranslateErrors
from app.shared.unit import UnitNotFound
from app.units.adapters.schemas import UnitIn, UnitOut, UnitPatch
from app.units.adapters.sql_units import FinerQuantity, SqlUnits
from app.units.application import manage_units
from app.units.application.ports import UnitUse
from app.units.domain.unit import UnitRuleBroken

router = APIRouter(prefix="/api/units", tags=["units"])

SessionDep = Annotated[Session, Depends(get_session)]


def get_units(request: Request, session: SessionDep, business_id: CurrentBusinessId) -> SqlUnits:
    # One clause per quantity column, each built by the hexagon that records it:
    # `app/main.py` hangs them on `app.state` so units never imports those hexagons.
    finer_quantities: Sequence[FinerQuantity] = request.app.state.units_finer_quantities
    return SqlUnits(session, business_id, finer_quantities)


def get_unit_use(request: Request, session: SessionDep, business_id: CurrentBusinessId) -> UnitUse:
    # Units never reads the product table: `app/main.py` hangs the products adapter that
    # counts a unit's products on `app.state` as a `(Session, business_id)` factory.
    factory = cast(Callable[[Session, int], UnitUse], request.app.state.units_use)
    return factory(session, business_id)


UnitsDep = Annotated[SqlUnits, Depends(get_units)]
UnitUseDep = Annotated[UnitUse, Depends(get_unit_use)]

as_http = TranslateErrors(
    [
        (404, (UnitNotFound,)),
        (422, (UnitRuleBroken,)),
    ]
)


@router.get("")
def list_units(units: UnitsDep, use: UnitUseDep) -> list[UnitOut]:
    return [UnitOut.of(counted) for counted in manage_units.list_units(units, use)]


@router.post("", status_code=201)
def add_unit(body: UnitIn, units: UnitsDep, session: SessionDep) -> UnitOut:
    with as_http:
        counted = manage_units.add_unit(units, session, body.name, body.label, body.decimals)
        return UnitOut.of(counted)


@router.patch("/{unit_id}")
def edit_unit(
    unit_id: int, body: UnitPatch, units: UnitsDep, use: UnitUseDep, session: SessionDep
) -> UnitOut:
    with as_http:
        counted = manage_units.edit_unit(
            units,
            use,
            session,
            unit_id,
            raw_name=body.name,
            raw_label=body.label,
            decimals=body.decimals,
        )
        return UnitOut.of(counted)


@router.delete("/{unit_id}", status_code=204)
def remove_unit(unit_id: int, units: UnitsDep, use: UnitUseDep, session: SessionDep) -> None:
    with as_http:
        manage_units.remove_unit(units, use, session, unit_id)
