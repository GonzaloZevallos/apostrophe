"""`SqlSetupStateStore` over real SQLite (the plan's declared seam): built for one
business, it writes only by `COALESCE` upserts, so a fact once set is never cleared nor
moved, and one business's writes never reach another's row."""

from collections.abc import Iterator
from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.accounts.adapters.tables import BusinessRow
from app.db import make_engine
from app.migrations.runner import upgrade_to_head
from app.results.adapters.sql_setup_state import SqlSetupStateStore
from app.results.adapters.tables import InicioSetupStateRow
from app.results.domain.setup import StoredSetup

FIRST = datetime(2026, 10, 3, 12, 0, tzinfo=UTC)
LATER = FIRST + timedelta(days=2)


@pytest.fixture
def session() -> Iterator[Session]:
    engine = make_engine("sqlite://")
    upgrade_to_head(engine)
    with Session(engine) as opened:
        yield opened
    engine.dispose()


def _business(session: Session, name: str) -> int:
    business = BusinessRow(name=name)
    session.add(business)
    session.commit()
    return business.id


def _row(session: Session, business_id: int) -> InicioSetupStateRow | None:
    session.expire_all()
    return session.scalar(
        select(InicioSetupStateRow).where(InicioSetupStateRow.business_id == business_id)
    )


def test_a_business_with_no_row_reads_as_nothing_stored(session: Session) -> None:
    business_id = _business(session, "A")

    assert SqlSetupStateStore(session, business_id).read() == StoredSetup(False, False)
    assert _row(session, business_id) is None


def test_marking_the_checklist_gone_is_read_back_and_keeps_the_first_instant(
    session: Session,
) -> None:
    business_id = _business(session, "A")
    store = SqlSetupStateStore(session, business_id)

    store.mark_checklist_gone(FIRST)
    store.mark_checklist_gone(LATER)
    session.commit()

    assert store.read() == StoredSetup(True, False)
    row = _row(session, business_id)
    assert row is not None and row.checklist_gone_at == FIRST


def test_dismissing_keeps_the_first_instant_too(session: Session) -> None:
    business_id = _business(session, "A")
    store = SqlSetupStateStore(session, business_id)

    store.dismiss_bot_notice(FIRST)
    store.dismiss_bot_notice(LATER)
    session.commit()

    assert store.read() == StoredSetup(False, True)
    row = _row(session, business_id)
    assert row is not None and row.bot_notice_dismissed_at == FIRST


def test_marking_gone_keeps_an_existing_dismissal_and_the_reverse(session: Session) -> None:
    business_id = _business(session, "A")
    store = SqlSetupStateStore(session, business_id)

    store.dismiss_bot_notice(FIRST)
    store.mark_checklist_gone(LATER)
    session.commit()
    row = _row(session, business_id)
    assert row is not None
    assert (row.bot_notice_dismissed_at, row.checklist_gone_at) == (FIRST, LATER)

    other_id = _business(session, "B")
    other = SqlSetupStateStore(session, other_id)
    other.mark_checklist_gone(FIRST)
    other.dismiss_bot_notice(LATER)
    session.commit()
    other_row = _row(session, other_id)
    assert other_row is not None
    assert (other_row.checklist_gone_at, other_row.bot_notice_dismissed_at) == (FIRST, LATER)


def test_one_business_s_writes_never_touch_another_s_row(session: Session) -> None:
    mine = _business(session, "A")
    theirs = _business(session, "B")
    SqlSetupStateStore(session, theirs).dismiss_bot_notice(FIRST)
    session.commit()

    SqlSetupStateStore(session, mine).mark_checklist_gone(LATER)
    SqlSetupStateStore(session, mine).dismiss_bot_notice(LATER)
    session.commit()

    assert SqlSetupStateStore(session, theirs).read() == StoredSetup(False, True)
    their_row = _row(session, theirs)
    assert their_row is not None
    assert (their_row.checklist_gone_at, their_row.bot_notice_dismissed_at) == (None, FIRST)
    assert SqlSetupStateStore(session, mine).read() == StoredSetup(True, True)
