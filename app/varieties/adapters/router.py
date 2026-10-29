from collections.abc import Callable
from datetime import date
from typing import Annotated, cast

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.accounts.adapters.deps import CurrentBusinessId
from app.clock import Clock, get_clock, get_today
from app.db import get_session
from app.http_errors import TranslateErrors
from app.shared.quantity import InvalidQuantity, Quantity
from app.varieties.adapters.schemas import (
    PriceEntryIn,
    PriceEntryOut,
    VarietyDetailOut,
    VarietyIn,
    VarietyOut,
)
from app.varieties.adapters.sql_varieties import SqlVarieties
from app.varieties.application import manage_prices, manage_varieties
from app.varieties.application.errors import (
    NameHeldByArchived,
    NameTaken,
    VarietyHasHistory,
    VarietyNotFound,
)
from app.varieties.application.ports import PricingSettingsReader, VarietyLeaving
from app.varieties.domain.variety import (
    DuplicateEffectiveDate,
    UnknownPriceEntry,
    VarietyArchived,
    VarietyRuleBroken,
    VipPriceNotBelowList,
)

router = APIRouter(prefix="/varieties", tags=["varieties"])


SessionDep = Annotated[Session, Depends(get_session)]


def get_varieties(session: SessionDep, business_id: CurrentBusinessId) -> SqlVarieties:
    return SqlVarieties(session, business_id)


def get_pricing_settings(
    request: Request, session: SessionDep, business_id: CurrentBusinessId
) -> PricingSettingsReader:
    # Varieties never imports `app.pricing_settings`: `app/main.py` hangs the real
    # reader on `app.state` as a `(Session, business_id)` factory (docs/adr/0006).
    factory = cast(
        Callable[[Session, int], PricingSettingsReader],
        request.app.state.varieties_pricing_settings,
    )
    return factory(session, business_id)


def get_leaving(
    request: Request, session: SessionDep, business_id: CurrentBusinessId
) -> VarietyLeaving:
    # Varieties never imports stock or the catalog (CODING_STANDARDS section 1):
    # `app/main.py` hangs their composite on `app.state.variety_leaving` as a factory,
    # the same shape `line_costs` uses.
    factory = cast(Callable[[Session, int], VarietyLeaving], request.app.state.variety_leaving)
    return factory(session, business_id)


VarietiesDep = Annotated[SqlVarieties, Depends(get_varieties)]
SettingsDep = Annotated[PricingSettingsReader, Depends(get_pricing_settings)]
LeavingDep = Annotated[VarietyLeaving, Depends(get_leaving)]
TodayDep = Annotated[date, Depends(get_today)]
ClockDep = Annotated[Clock, Depends(get_clock)]


as_http = TranslateErrors(
    [
        (404, (VarietyNotFound, VarietyArchived, UnknownPriceEntry)),
        (409, (NameTaken, NameHeldByArchived, VarietyHasHistory, DuplicateEffectiveDate)),
        (422, (VarietyRuleBroken, VipPriceNotBelowList, InvalidQuantity)),
    ]
)


@router.get("")
def list_varieties(
    varieties: VarietiesDep, today: TodayDep, on: date | None = None, archived: bool = False
) -> list[VarietyOut]:
    """Each variety's current price as of `on` (today when omitted, docs/adr/0011),
    inside the session's own business. Archived varieties only with `archived=true`."""
    day = on or today
    listed = manage_varieties.list_varieties(varieties, archived=archived)
    return [VarietyOut.of(v, day) for v in listed]


@router.post("", status_code=201)
def register_variety(
    body: VarietyIn, varieties: VarietiesDep, session: SessionDep, today: TodayDep
) -> VarietyOut:
    with as_http:
        variety = manage_varieties.register_variety(varieties, session, body.name)
        return VarietyOut.of(variety, today)


@router.get("/{variety_id}")
def get_variety(variety_id: int, varieties: VarietiesDep, today: TodayDep) -> VarietyDetailOut:
    with as_http:
        variety = manage_varieties.get_variety(varieties, variety_id)
        removal = manage_varieties.removal_offered(varieties, variety)
        return VarietyDetailOut(**VarietyOut.of(variety, today).model_dump(), removal=removal)


@router.delete("/{variety_id}", status_code=204)
def delete_variety(
    variety_id: int, varieties: VarietiesDep, leaving: LeavingDep, session: SessionDep
) -> None:
    with as_http:
        manage_varieties.delete_variety(varieties, leaving, session, variety_id)


@router.patch("/{variety_id}")
def rename_variety(
    variety_id: int,
    body: VarietyIn,
    varieties: VarietiesDep,
    session: SessionDep,
    today: TodayDep,
) -> VarietyOut:
    with as_http:
        variety = manage_varieties.rename_variety(varieties, session, variety_id, body.name)
        return VarietyOut.of(variety, today)


@router.post("/{variety_id}/archive")
def archive_variety(
    variety_id: int,
    varieties: VarietiesDep,
    session: SessionDep,
    today: TodayDep,
    clock: ClockDep,
) -> VarietyOut:
    with as_http:
        variety = manage_varieties.archive_variety(varieties, session, variety_id, clock())
        return VarietyOut.of(variety, today)


@router.post("/{variety_id}/restore")
def restore_variety(
    variety_id: int, varieties: VarietiesDep, session: SessionDep, today: TodayDep
) -> VarietyOut:
    with as_http:
        variety = manage_varieties.restore_variety(varieties, session, variety_id)
        return VarietyOut.of(variety, today)


@router.get("/{variety_id}/prices")
def price_history(variety_id: int, varieties: VarietiesDep) -> list[PriceEntryOut]:
    with as_http:
        variety = manage_varieties.get_variety(varieties, variety_id)
        return [PriceEntryOut.of(e) for e in variety.price_history()]


@router.post("/{variety_id}/prices", status_code=201)
def record_price_entry(
    variety_id: int,
    body: PriceEntryIn,
    varieties: VarietiesDep,
    settings: SettingsDep,
    session: SessionDep,
) -> PriceEntryOut:
    with as_http:
        bulk_minimum = None if body.bulk_minimum is None else Quantity.of(body.bulk_minimum)
        entry = manage_prices.record_price_entry(
            varieties,
            settings,
            session,
            variety_id,
            effective_from=body.effective_from,
            list_price=body.list_price,
            bulk_price=body.bulk_price,
            bulk_minimum=bulk_minimum,
            vip_price=body.vip_price,
        )
        return PriceEntryOut.of(entry)


@router.delete("/{variety_id}/prices/{entry_id}", status_code=204)
def delete_price_entry(
    variety_id: int, entry_id: int, varieties: VarietiesDep, session: SessionDep
) -> None:
    with as_http:
        manage_prices.delete_price_entry(varieties, session, variety_id, entry_id)


@router.get("/{variety_id}/current-price")
def current_price(
    variety_id: int, varieties: VarietiesDep, today: TodayDep, on: date | None = None
) -> PriceEntryOut:
    """The price entry in force on `on` (today when omitted); 404 when there is none."""
    with as_http:
        day = on or today
        entry = manage_prices.current_price(varieties, variety_id, day)
    if entry is None:
        raise HTTPException(status_code=404, detail=f"no price in force on {day}")
    return PriceEntryOut.of(entry)
