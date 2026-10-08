from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, Request
from sqlalchemy.orm import Session

from app.accounts.adapters.deps import CurrentBusinessId
from app.db import get_session
from app.pinned_catalog.adapters.upkeep_trigger import schedule_upkeep
from app.pricing_settings.adapters.schemas import PricingSettingsBody
from app.pricing_settings.adapters.sql_pricing_settings import SqlPricingSettings
from app.pricing_settings.application.save_pricing_settings import save_pricing_settings

router = APIRouter(prefix="/pricing-settings", tags=["pricing-settings"])

SessionDep = Annotated[Session, Depends(get_session)]


def get_store(session: SessionDep, business_id: CurrentBusinessId) -> SqlPricingSettings:
    return SqlPricingSettings(session, business_id)


StoreDep = Annotated[SqlPricingSettings, Depends(get_store)]


@router.get("")
def get_pricing_settings(store: StoreDep) -> PricingSettingsBody:
    return PricingSettingsBody.of(store.current())


@router.put("")
def put_pricing_settings(
    body: PricingSettingsBody,
    store: StoreDep,
    session: SessionDep,
    request: Request,
    background_tasks: BackgroundTasks,
    business_id: CurrentBusinessId,
) -> PricingSettingsBody:
    changed = save_pricing_settings(store, session, body.to_settings())
    # Only a changed switch can change the pinned catalog's text (docs/adr/0014): an
    # unchanged save schedules nothing.
    if changed:
        schedule_upkeep(request, background_tasks, business_id)
    return PricingSettingsBody.of(store.current())
