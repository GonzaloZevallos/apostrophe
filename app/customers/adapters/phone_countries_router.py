"""`GET /phone-countries`: the listed Phone countries with the example a seller types
(docs/adr/20261111-phone-country-per-number).
The same constant for every business, read from the shared table; the
route asks for a session and reads nothing with it."""

from fastapi import APIRouter
from pydantic import BaseModel

from app.accounts.adapters.deps import CurrentBusinessId
from app.shared.phone_country import listed_countries

router = APIRouter(tags=["customers"])


class PhoneCountryOut(BaseModel):
    code: str
    # The digits of the calling code, without the "+".
    calling_code: str
    national_lengths: list[int]
    example: str


@router.get("/phone-countries")
def list_phone_countries(business_id: CurrentBusinessId) -> list[PhoneCountryOut]:
    del business_id  # the list is the same for every business
    return [
        PhoneCountryOut(
            code=country.value,
            calling_code=country.rule.calling_code,
            national_lengths=sorted(country.rule.national_lengths),
            example=country.rule.example,
        )
        for country in listed_countries()
    ]
