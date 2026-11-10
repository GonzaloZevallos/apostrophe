"""The accounts Phone country reader and `SqlAccounts` over `business.default_phone_country`
(docs/adr/0073): `current()` reads the one business it is built for, and a stored code that
is not listed is a broken row that never echoes its value."""

from collections.abc import Iterator

import pytest
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from app.accounts.adapters.sql_accounts import SqlAccounts
from app.accounts.adapters.sql_phone_country import SqlPhoneCountry
from app.accounts.adapters.tables import BusinessRow
from app.accounts.domain.account import (
    Business,
    BusinessName,
    StoredPhoneCountryCorrupt,
)
from app.migrations.runner import upgrade_to_head
from app.shared.language import ENGLISH, BusinessLanguage
from app.shared.phone_country import PhoneCountry


@pytest.fixture
def session(engine: Engine) -> Iterator[Session]:
    upgrade_to_head(engine)
    with Session(engine) as session:
        yield session


def _stored(session: Session, code: str | None, name: str = "La Huerta") -> int:
    row = BusinessRow(name=name, language="en", default_phone_country=code)
    session.add(row)
    session.commit()
    return row.id


def test_current_reads_the_country_of_the_business_it_is_built_for(session: Session) -> None:
    uruguay = _stored(session, "UY", "Uno")
    none = _stored(session, None, "Dos")
    brazil = _stored(session, "BR", "Tres")

    assert SqlPhoneCountry(session, uruguay).current() is PhoneCountry.UY
    assert SqlPhoneCountry(session, none).current() is None
    assert SqlPhoneCountry(session, brazil).current() is PhoneCountry.BR


def test_a_stored_code_off_the_list_is_a_corrupt_row_whose_message_never_holds_it(
    session: Session,
) -> None:
    business_id = _stored(session, "ZZ")

    with pytest.raises(StoredPhoneCountryCorrupt) as from_reader:
        SqlPhoneCountry(session, business_id).current()
    with pytest.raises(StoredPhoneCountryCorrupt) as from_accounts:
        SqlAccounts(session).business(business_id)

    assert "ZZ" not in str(from_reader.value)
    assert "ZZ" not in str(from_accounts.value)


def test_accounts_adds_a_business_with_null_and_saves_a_country(session: Session) -> None:
    accounts = SqlAccounts(session)
    added = accounts.add_business(Business(BusinessName("Nueva"), BusinessLanguage(ENGLISH), None))
    assert added.id is not None
    assert SqlPhoneCountry(session, added.id).current() is None

    accounts.save_business(
        Business(BusinessName("Nueva"), BusinessLanguage(ENGLISH), PhoneCountry.CL, added.id)
    )

    assert SqlPhoneCountry(session, added.id).current() is PhoneCountry.CL
    reloaded = accounts.business(added.id)
    assert reloaded is not None
    assert reloaded.phone_country is PhoneCountry.CL
