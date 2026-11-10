"""`PUT /business/phone-country`: the one way a user changes the business's Phone country
(docs/adr/0073). The business comes from the session only; stored phone numbers are never
touched."""

from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.accounts.adapters.deps import CurrentBusinessId, get_accounts
from app.accounts.adapters.sql_accounts import SqlAccounts
from app.accounts.application import manage_business
from app.db import get_session
from app.http_errors import TranslateErrors
from app.shared.phone_country import PhoneCountry, UnknownPhoneCountry

router = APIRouter(tags=["accounts"])

as_http = TranslateErrors([(422, (UnknownPhoneCountry,))])


class PhoneCountryOption(BaseModel):
    code: str
    # The digits of the calling code, without the "+" (the front shows the "+").
    calling_code: str


def phone_country_options() -> list[PhoneCountryOption]:
    """Every country a business may choose, in the order Settings lists them."""
    return [
        PhoneCountryOption(code=country.value, calling_code=country.rule.calling_code)
        for country in PhoneCountry
    ]


class PhoneCountryIn(BaseModel):
    phone_country: str | None


class BusinessPhoneCountryOut(BaseModel):
    """The `GET /business` Phone country fields: the stored code or null, and the options."""

    phone_country: str | None
    phone_countries: list[PhoneCountryOption]


@router.put("/business/phone-country")
def change_phone_country(
    body: PhoneCountryIn,
    business_id: CurrentBusinessId,
    accounts: Annotated[SqlAccounts, Depends(get_accounts)],
    session: Annotated[Session, Depends(get_session)],
) -> BusinessPhoneCountryOut:
    with as_http:
        profile = manage_business.change_phone_country(
            accounts, session, business_id, body.phone_country
        )
    return BusinessPhoneCountryOut(
        phone_country=profile.phone_country, phone_countries=phone_country_options()
    )
