from collections.abc import Callable
from datetime import date
from typing import Annotated, cast

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.accounts.adapters.deps import CurrentBusinessId
from app.catalog.adapters.schemas import (
    ArchivedCatalogVarietyOut,
    CatalogAttributesIn,
    CatalogOut,
    HeaderFooterIn,
)
from app.catalog.adapters.sql_attributes import SqlCatalogAttributes
from app.catalog.adapters.sql_catalog_varieties import SqlCatalogVarieties
from app.catalog.adapters.sql_header_footer import SqlCatalogHeaderFooter
from app.catalog.adapters.stock_status import StockStatusesFromStock
from app.catalog.application import set_header_footer as set_header_footer_uc
from app.catalog.application import set_variety_attributes as set_variety_attributes_uc
from app.catalog.application.errors import CatalogVarietyArchived, CatalogVarietyNotFound
from app.catalog.application.ports import CatalogPricingSettings
from app.catalog.application.read_archived import read_archived
from app.catalog.application.read_catalog import read_catalog
from app.catalog.domain.errors import (
    AromaTooLong,
    EmojiInvalid,
    FooterTooLong,
    HeaderTooLong,
    IndicaShareInvalid,
)
from app.clock import get_today
from app.db import get_session
from app.http_errors import TranslateErrors
from app.varieties.application.errors import VarietyArchived

router = APIRouter(prefix="/catalog", tags=["catalog"])

SessionDep = Annotated[Session, Depends(get_session)]
TodayDep = Annotated[date, Depends(get_today)]


def get_varieties(session: SessionDep, business_id: CurrentBusinessId) -> SqlCatalogVarieties:
    return SqlCatalogVarieties(session, business_id)


def get_stock(session: SessionDep, business_id: CurrentBusinessId) -> StockStatusesFromStock:
    return StockStatusesFromStock(session, business_id)


def get_attributes(session: SessionDep, business_id: CurrentBusinessId) -> SqlCatalogAttributes:
    return SqlCatalogAttributes(session, business_id)


def get_header_footer(
    session: SessionDep, business_id: CurrentBusinessId
) -> SqlCatalogHeaderFooter:
    return SqlCatalogHeaderFooter(session, business_id)


def get_pricing_settings(
    request: Request, session: SessionDep, business_id: CurrentBusinessId
) -> CatalogPricingSettings:
    # The catalog reaches the switches only through its own port; `app/main.py` puts the
    # real implementation on `app.state.catalog_pricing_settings` as a factory (ADR-0006).
    factory = cast(
        Callable[[Session, int], CatalogPricingSettings],
        request.app.state.catalog_pricing_settings,
    )
    return factory(session, business_id)


VarietiesDep = Annotated[SqlCatalogVarieties, Depends(get_varieties)]
StockDep = Annotated[StockStatusesFromStock, Depends(get_stock)]
AttributesDep = Annotated[SqlCatalogAttributes, Depends(get_attributes)]
HeaderFooterDep = Annotated[SqlCatalogHeaderFooter, Depends(get_header_footer)]
PricingSettingsDep = Annotated[CatalogPricingSettings, Depends(get_pricing_settings)]


as_http = TranslateErrors(
    [
        (404, (CatalogVarietyNotFound, VarietyArchived)),
        (422, (EmojiInvalid, IndicaShareInvalid, AromaTooLong, HeaderTooLong, FooterTooLong)),
    ]
)


@router.get("")
def get_catalog(
    varieties: VarietiesDep,
    stock: StockDep,
    attributes: AttributesDep,
    header_footer: HeaderFooterDep,
    pricing_settings: PricingSettingsDep,
    today: TodayDep,
) -> CatalogOut:
    view = read_catalog(varieties, stock, attributes, header_footer, pricing_settings, today)
    return CatalogOut.of(view)


@router.get("/archived")
def get_archived(
    varieties: VarietiesDep, attributes: AttributesDep
) -> list[ArchivedCatalogVarietyOut]:
    return [ArchivedCatalogVarietyOut.of(view) for view in read_archived(varieties, attributes)]


@router.put("/varieties/{variety_id}")
def put_variety_attributes(
    variety_id: int,
    body: CatalogAttributesIn,
    varieties: VarietiesDep,
    stock: StockDep,
    attributes: AttributesDep,
    header_footer: HeaderFooterDep,
    pricing_settings: PricingSettingsDep,
    session: SessionDep,
    today: TodayDep,
) -> CatalogOut:
    with as_http:
        try:
            view = set_variety_attributes_uc.set_variety_attributes(
                varieties,
                stock,
                attributes,
                header_footer,
                pricing_settings,
                session,
                variety_id,
                body.shown,
                body.emoji,
                body.indica_share,
                body.aroma,
                today,
            )
        except CatalogVarietyArchived as exc:
            raise VarietyArchived(variety_id) from exc
        return CatalogOut.of(view)


@router.put("/header-footer")
def put_header_footer(
    body: HeaderFooterIn,
    varieties: VarietiesDep,
    stock: StockDep,
    attributes: AttributesDep,
    header_footer: HeaderFooterDep,
    pricing_settings: PricingSettingsDep,
    session: SessionDep,
    today: TodayDep,
) -> CatalogOut:
    with as_http:
        view = set_header_footer_uc.set_header_footer(
            varieties,
            stock,
            attributes,
            header_footer,
            pricing_settings,
            session,
            body.header,
            body.footer,
            today,
        )
        return CatalogOut.of(view)
