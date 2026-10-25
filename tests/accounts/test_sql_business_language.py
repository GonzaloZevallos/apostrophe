"""The stored language of a business through `SqlAccounts` (docs/adr/0050): a well-formed
tag loads whether or not it is selectable, a malformed one is a broken row that never
echoes its value."""

from collections.abc import Iterator

import pytest
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from app.accounts.adapters.sql_accounts import SqlAccounts
from app.accounts.adapters.tables import BusinessRow
from app.accounts.domain.account import StoredLanguageCorrupt
from app.migrations.runner import upgrade_to_head
from app.shared.language import Language


@pytest.fixture
def session(engine: Engine) -> Iterator[Session]:
    upgrade_to_head(engine)
    with Session(engine) as session:
        yield session


def _stored(session: Session, language: str) -> int:
    row = BusinessRow(name="La Huerta", language=language)
    session.add(row)
    session.commit()
    return row.id


def test_a_well_formed_tag_loads_even_when_it_is_selectable_nowhere(session: Session) -> None:
    business = SqlAccounts(session).business(_stored(session, "fr"))

    assert business is not None
    assert business.language.language == Language("fr")


def test_a_malformed_tag_is_a_corrupt_row_whose_message_never_holds_the_value(
    session: Session,
) -> None:
    business_id = _stored(session, "EN")

    with pytest.raises(StoredLanguageCorrupt) as raised:
        SqlAccounts(session).business(business_id)

    assert "EN" not in str(raised.value)
