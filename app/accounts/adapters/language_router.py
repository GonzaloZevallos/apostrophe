"""`PUT /business/language`: the one way a user changes the stored language
(docs/adr/0050). The business comes from the session only."""

from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.accounts.adapters.deps import CurrentBusinessId, get_accounts, get_settings
from app.accounts.adapters.sql_accounts import SqlAccounts
from app.accounts.application import manage_business
from app.db import get_session
from app.http_errors import TranslateErrors
from app.pinned_catalog.adapters.upkeep_trigger import schedule_upkeep
from app.settings import Settings
from app.shared.language import LanguageNotSelectable

router = APIRouter(tags=["accounts"])

as_http = TranslateErrors([(422, (LanguageNotSelectable,))])


class LanguageIn(BaseModel):
    language: str


class BusinessLanguageOut(BaseModel):
    """The `GET /business` language fields: the stored tag, never the shown one."""

    language: str
    selectable_languages: list[str]


@router.put("/business/language")
def change_language(
    body: LanguageIn,
    request: Request,
    background_tasks: BackgroundTasks,
    business_id: CurrentBusinessId,
    accounts: Annotated[SqlAccounts, Depends(get_accounts)],
    session: Annotated[Session, Depends(get_session)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> BusinessLanguageOut:
    with as_http:
        changed = manage_business.change_business_language(
            accounts, session, business_id, body.language, settings.selectable_languages
        )
    # Only a changed language can owe the pinned catalog an edit (docs/adr/0014): choosing
    # the stored one schedules nothing.
    if changed:
        schedule_upkeep(request, background_tasks, business_id)
    profile = manage_business.business_profile(accounts, business_id)
    return BusinessLanguageOut(
        language=profile.language,
        selectable_languages=[language.tag for language in settings.selectable_languages],
    )
