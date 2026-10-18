"""`SqlFirstRuns` over a real SQLite (docs/adr/0046): a stamp is the insert-or-nothing
and the guarded update, nothing else; stamping twice keeps the first instant; another
business's row does not exist from here; the repository never commits."""

from collections.abc import Iterator
from datetime import UTC, datetime, timedelta
from typing import Any

import pytest
from sqlalchemy import event, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from app.migrations.runner import upgrade_to_head
from app.onboarding.adapters.sql_first_runs import SqlFirstRuns
from app.onboarding.domain.first_run import FirstRun, Stamp

FIRST = datetime(2026, 10, 1, 12, 0, tzinfo=UTC)
LATER = FIRST + timedelta(days=3)


@pytest.fixture
def session(engine: Engine) -> Iterator[Session]:
    upgrade_to_head(engine)
    with engine.begin() as connection:
        connection.execute(text("INSERT INTO business (id, name) VALUES (1, 'a'), (2, 'b')"))
    with Session(engine) as session:
        yield session


def test_a_business_with_no_row_has_no_stamps(session: Session) -> None:
    assert SqlFirstRuns(session, 1).get() is None


def test_a_stamp_creates_the_row_and_sets_only_its_column(session: Session) -> None:
    first_runs = SqlFirstRuns(session, 1)

    first_runs.stamp(Stamp.CHECKLIST_GONE, FIRST)

    assert first_runs.get() == FirstRun(checklist_gone_at=FIRST)


def test_stamping_twice_keeps_the_first_instant(session: Session) -> None:
    first_runs = SqlFirstRuns(session, 1)
    first_runs.get()
    first_runs.stamp(Stamp.IMPORT_NOTICE_OVER, FIRST)

    first_runs.stamp(Stamp.IMPORT_NOTICE_OVER, LATER)

    assert first_runs.get() == FirstRun(import_notice_over_at=FIRST)


def test_a_second_stamp_goes_on_the_same_row_and_leaves_the_first(session: Session) -> None:
    first_runs = SqlFirstRuns(session, 1)
    first_runs.stamp(Stamp.CHECKLIST_GONE, FIRST)

    first_runs.stamp(Stamp.IMPORT_NOTICE_OVER, LATER)

    assert first_runs.get() == FirstRun(checklist_gone_at=FIRST, import_notice_over_at=LATER)
    assert session.execute(text("SELECT COUNT(*) FROM first_run")).scalar_one() == 1


def test_imported_stamps_imported_at_and_keeps_the_first_instant(session: Session) -> None:
    first_runs = SqlFirstRuns(session, 1)

    first_runs.imported(FIRST)
    first_runs.imported(LATER)

    assert first_runs.get() == FirstRun(imported_at=FIRST)


def test_another_business_has_its_own_row_and_cannot_see_this_one(session: Session) -> None:
    SqlFirstRuns(session, 1).stamp(Stamp.CHECKLIST_GONE, FIRST)

    assert SqlFirstRuns(session, 2).get() is None
    SqlFirstRuns(session, 2).stamp(Stamp.IMPORTED, LATER)
    assert SqlFirstRuns(session, 1).get() == FirstRun(checklist_gone_at=FIRST)
    assert SqlFirstRuns(session, 2).get() == FirstRun(imported_at=LATER)


def test_a_stamp_writes_exactly_the_insert_then_the_guarded_update(
    engine: Engine, session: Session
) -> None:
    statements: list[str] = []

    def record(*args: Any) -> None:
        statements.append(str(args[2]))

    event.listen(engine, "before_cursor_execute", record)
    SqlFirstRuns(session, 1).stamp(Stamp.CHECKLIST_GONE, FIRST)
    event.remove(engine, "before_cursor_execute", record)

    assert len(statements) == 2
    assert statements[0].startswith("INSERT INTO first_run")
    assert "ON CONFLICT (business_id) DO NOTHING" in statements[0]
    assert statements[1].startswith("UPDATE first_run SET checklist_gone_at=")
    assert "business_id = ?" in statements[1]
    assert "checklist_gone_at IS NULL" in statements[1]


def test_the_repository_never_commits(engine: Engine, session: Session) -> None:
    SqlFirstRuns(session, 1).stamp(Stamp.CHECKLIST_GONE, FIRST)

    session.rollback()

    assert SqlFirstRuns(session, 1).get() is None
