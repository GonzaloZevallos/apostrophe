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
from app.products.adapters.schemas import (
    PriceEntryIn,
    PriceEntryOut,
    VarietyDetailOut,
    VarietyIn,
    VarietyOut,
)
from app.products.adapters.sql_products import SqlProducts
from app.products.application import manage_prices, manage_products
from app.products.application.errors import (
    NameHeldByArchived,
    NameTaken,
    ProductHasHistory,
    ProductNotFound,
)
from app.products.application.ports import PricingSettingsReader, ProductLeaving
from app.products.domain.product import (
    DuplicateEffectiveDate,
    UnknownPriceEntry,
    ProductArchived,
    ProductRuleBroken,
    VipPriceNotBelowList,
)

router = APIRouter(prefix="/varieties", tags=["varieties"])


SessionDep = Annotated[Session, Depends(get_session)]


def get_products(session: SessionDep, business_id: CurrentBusinessId) -> SqlProducts:
    return SqlProducts(session, business_id)


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
) -> ProductLeaving:
    # Varieties never imports stock or the catalog (CODING_STANDARDS section 1):
    # `app/main.py` hangs their composite on `app.state.variety_leaving` as a factory,
    # the same shape `line_costs` uses.
    factory = cast(Callable[[Session, int], ProductLeaving], request.app.state.variety_leaving)
    return factory(session, business_id)


ProductsDep = Annotated[SqlProducts, Depends(get_products)]
SettingsDep = Annotated[PricingSettingsReader, Depends(get_pricing_settings)]
LeavingDep = Annotated[ProductLeaving, Depends(get_leaving)]
TodayDep = Annotated[date, Depends(get_today)]
ClockDep = Annotated[Clock, Depends(get_clock)]


as_http = TranslateErrors(
    [
        (404, (ProductNotFound, ProductArchived, UnknownPriceEntry)),
        (409, (NameTaken, NameHeldByArchived, ProductHasHistory, DuplicateEffectiveDate)),
        (422, (ProductRuleBroken, VipPriceNotBelowList, InvalidQuantity)),
    ]
)


@router.get("")
def list_varieties(
    products: ProductsDep, today: TodayDep, on: date | None = None, archived: bool = False
) -> list[VarietyOut]:
    """Each variety's current price as of `on` (today when omitted, docs/adr/0011),
    inside the session's own business. Archived varieties only with `archived=true`."""
    day = on or today
    listed = manage_products.list_products(products, archived=archived)
    return [VarietyOut.of(v, day) for v in listed]


@router.post("", status_code=201)
def register_variety(
    body: VarietyIn, products: ProductsDep, session: SessionDep, today: TodayDep
) -> VarietyOut:
    with as_http:
        product = manage_products.register_product(products, session, body.name)
        return VarietyOut.of(product, today)


@router.get("/{variety_id}")
def get_variety(variety_id: int, products: ProductsDep, today: TodayDep) -> VarietyDetailOut:
    with as_http:
        product = manage_products.get_product(products, product_id=variety_id)
        removal = manage_products.removal_offered(products, product)
        return VarietyDetailOut(**VarietyOut.of(product, today).model_dump(), removal=removal)


@router.delete("/{variety_id}", status_code=204)
def delete_variety(
    variety_id: int, products: ProductsDep, leaving: LeavingDep, session: SessionDep
) -> None:
    with as_http:
        manage_products.delete_product(products, leaving, session, product_id=variety_id)


@router.patch("/{variety_id}")
def rename_variety(
    variety_id: int,
    body: VarietyIn,
    products: ProductsDep,
    session: SessionDep,
    today: TodayDep,
) -> VarietyOut:
    with as_http:
        product = manage_products.rename_product(products, session, product_id=variety_id, raw_name=body.name)
        return VarietyOut.of(product, today)


@router.post("/{variety_id}/archive")
def archive_variety(
    variety_id: int,
    products: ProductsDep,
    session: SessionDep,
    today: TodayDep,
    clock: ClockDep,
) -> VarietyOut:
    with as_http:
        product = manage_products.archive_product(products, session, product_id=variety_id, at=clock())
        return VarietyOut.of(product, today)


@router.post("/{variety_id}/restore")
def restore_variety(
    variety_id: int, products: ProductsDep, session: SessionDep, today: TodayDep
) -> VarietyOut:
    with as_http:
        product = manage_products.restore_product(products, session, product_id=variety_id)
        return VarietyOut.of(product, today)


@router.get("/{variety_id}/prices")
def price_history(variety_id: int, products: ProductsDep) -> list[PriceEntryOut]:
    with as_http:
        product = manage_products.get_product(products, product_id=variety_id)
        return [PriceEntryOut.of(e) for e in product.price_history()]


@router.post("/{variety_id}/prices", status_code=201)
def record_price_entry(
    variety_id: int,
    body: PriceEntryIn,
    products: ProductsDep,
    settings: SettingsDep,
    session: SessionDep,
) -> PriceEntryOut:
    with as_http:
        bulk_minimum = None if body.bulk_minimum is None else Quantity.of(body.bulk_minimum)
        entry = manage_prices.record_price_entry(
            products,
            settings,
            session,
            product_id=variety_id,
            effective_from=body.effective_from,
            list_price=body.list_price,
            bulk_price=body.bulk_price,
            bulk_minimum=bulk_minimum,
            vip_price=body.vip_price,
        )
        return PriceEntryOut.of(entry)


@router.delete("/{variety_id}/prices/{entry_id}", status_code=204)
def delete_price_entry(
    variety_id: int, entry_id: int, products: ProductsDep, session: SessionDep
) -> None:
    with as_http:
        manage_prices.delete_price_entry(products, session, product_id=variety_id, entry_id=entry_id)


@router.get("/{variety_id}/current-price")
def current_price(
    variety_id: int, products: ProductsDep, today: TodayDep, on: date | None = None
) -> PriceEntryOut:
    """The price entry in force on `on` (today when omitted); 404 when there is none."""
    with as_http:
        day = on or today
        entry = manage_prices.current_price(products, product_id=variety_id, on=day)
    if entry is None:
        raise HTTPException(status_code=404, detail=f"no price in force on {day}")
    return PriceEntryOut.of(entry)
