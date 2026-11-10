"""The business's Phone country over `business.default_phone_country`. Built for one
business (docs/adr/0082); a stored code that is not listed is `StoredPhoneCountryCorrupt`,
never a guess."""

from sqlalchemy.orm import Session

from app.accounts.adapters.tables import BusinessRow
from app.accounts.domain.account import StoredPhoneCountryCorrupt
from app.shared.phone_country import PhoneCountry, UnknownPhoneCountry


class SqlPhoneCountry:
    def __init__(self, session: Session, business_id: int) -> None:
        self._session = session
        self._business_id = business_id

    def current(self) -> PhoneCountry | None:
        code = self._session.get_one(BusinessRow, self._business_id).default_phone_country
        if code is None:
            return None
        try:
            return PhoneCountry.parse(code)
        except UnknownPhoneCountry:
            raise StoredPhoneCountryCorrupt from None
