"""The zone names a business may choose and the use case that stores one (docs/adr/0057):
membership in `accepted_time_zones()` is the only gate for a new name, the write is one
conditional UPDATE, and it commits once."""

from collections.abc import Iterator

import pytest
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from app.accounts.adapters.sql_accounts import SqlAccounts
from app.accounts.adapters.tables import BusinessRow
from app.accounts.application.manage_business import change_time_zone
from app.accounts.domain.account import UnknownTimeZone
from app.accounts.domain.time_zone import accepted_time_zones
from app.migrations.runner import upgrade_to_head
from app.shared.calendar import load_zone

ARGENTINA = "America/Argentina/Buenos_Aires"


class CountingTransaction:
    def __init__(self) -> None:
        self.commits = 0

    def commit(self) -> None:
        self.commits += 1

    def rollback(self) -> None:
        raise AssertionError("the use case never rolls back")


@pytest.fixture
def session(engine: Engine) -> Iterator[Session]:
    upgrade_to_head(engine)
    with Session(engine) as session:
        yield session


def _business(session: Session, zone: str = ARGENTINA) -> int:
    row = BusinessRow(name="La Huerta", language="en", time_zone=zone)
    session.add(row)
    session.commit()
    return row.id


def _stored(session: Session, business_id: int) -> str:
    session.expire_all()
    return session.get_one(BusinessRow, business_id).time_zone


def test_the_accepted_names_are_sorted_region_names_that_all_load() -> None:
    names = accepted_time_zones()

    assert list(names) == sorted(names)
    assert {ARGENTINA, "Europe/Madrid", "Pacific/Auckland", "America/Mexico_City"} <= set(names)
    assert all(load_zone(name) is not None for name in names)


@pytest.mark.parametrize(
    "refused", ["US/Eastern", "Etc/GMT+5", "UTC", "GMT", "america/mexico_city", "Mars/Olympus", ""]
)
def test_aliases_etc_names_other_cases_and_unknown_names_are_not_accepted(refused: str) -> None:
    assert refused not in accepted_time_zones()


def test_a_different_accepted_zone_is_stored_with_one_commit(session: Session) -> None:
    business_id = _business(session)
    transaction = CountingTransaction()

    changed = change_time_zone(SqlAccounts(session), transaction, business_id, "Europe/Madrid")

    assert changed is True
    assert transaction.commits == 1
    assert _stored(session, business_id) == "Europe/Madrid"


def test_the_stored_zone_again_changes_and_commits_nothing(session: Session) -> None:
    business_id = _business(session)
    transaction = CountingTransaction()

    changed = change_time_zone(SqlAccounts(session), transaction, business_id, ARGENTINA)

    assert changed is False
    assert transaction.commits == 0


def test_a_stored_name_off_the_list_is_kept_when_chosen_again_but_cannot_be_chosen_anew(
    session: Session,
) -> None:
    business_id = _business(session, "Etc/GMT+5")
    other = _business(session)

    kept = change_time_zone(SqlAccounts(session), CountingTransaction(), business_id, "Etc/GMT+5")
    with pytest.raises(UnknownTimeZone):
        change_time_zone(SqlAccounts(session), CountingTransaction(), other, "Etc/GMT+5")

    assert kept is False
    assert _stored(session, other) == ARGENTINA


@pytest.mark.parametrize("refused", ["US/Eastern", "Etc/GMT+5", "america/mexico_city", "", "x"])
def test_a_name_off_the_list_is_refused_without_a_write_or_a_commit(
    session: Session, refused: str
) -> None:
    business_id = _business(session)
    transaction = CountingTransaction()

    with pytest.raises(UnknownTimeZone) as raised:
        change_time_zone(SqlAccounts(session), transaction, business_id, refused)

    assert transaction.commits == 0
    assert _stored(session, business_id) == ARGENTINA
    assert refused not in str(raised.value) or not refused


def test_a_zone_change_touches_only_its_own_business(session: Session) -> None:
    mine = _business(session)
    theirs = _business(session)

    change_time_zone(SqlAccounts(session), CountingTransaction(), mine, "Asia/Tokyo")

    assert _stored(session, theirs) == ARGENTINA
