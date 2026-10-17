"""`POST /panel/bot-notice/dismissal` (CODING_STANDARDS section 5: behaviour test,
`TestClient`, real adapters, the movable clock). Inicio's one write besides Cobrar: it
takes no body, answers 204 every time, stores the moment from the injected clock once,
and only for the session's own business."""

from datetime import UTC, datetime, timedelta

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from app.results.adapters.tables import InicioSetupStateRow
from tests.conftest import NOW, MovableClock


def _rows(engine: Engine) -> list[tuple[int, datetime | None, datetime | None]]:
    with Session(engine) as session:
        return [
            (row.business_id, row.checklist_gone_at, row.bot_notice_dismissed_at)
            for row in session.scalars(
                select(InicioSetupStateRow).order_by(InicioSetupStateRow.business_id)
            )
        ]


def test_dismissing_answers_204_and_stores_the_clock_s_instant(
    client: TestClient, engine: Engine
) -> None:
    response = client.post("/panel/bot-notice/dismissal")

    assert response.status_code == 204
    assert response.content == b""
    [(_, gone_at, dismissed_at)] = _rows(engine)
    assert dismissed_at == NOW.astimezone(UTC)
    assert gone_at is None


def test_a_second_dismissal_answers_204_and_the_first_instant_stands(
    client: TestClient, engine: Engine, clock: MovableClock
) -> None:
    client.post("/panel/bot-notice/dismissal")
    clock.set(NOW + timedelta(days=3))

    again = client.post("/panel/bot-notice/dismissal")

    assert again.status_code == 204
    [(_, _, dismissed_at)] = _rows(engine)
    assert dismissed_at == NOW.astimezone(UTC)


def test_another_business_dismissing_leaves_the_first_business_s_state_unchanged(
    client: TestClient, other_client: TestClient, engine: Engine, clock: MovableClock
) -> None:
    client.post("/panel/bot-notice/dismissal")
    before = _rows(engine)
    clock.set(NOW + timedelta(days=1))

    other_client.post("/panel/bot-notice/dismissal")

    after = _rows(engine)
    assert after[0] == before[0]
    assert len(after) == 2
    assert after[1][0] != after[0][0]
    assert after[1][2] == NOW.astimezone(UTC) + timedelta(days=1)


def test_dismissing_without_a_session_is_refused(anonymous_client: TestClient) -> None:
    assert anonymous_client.post("/panel/bot-notice/dismissal").status_code == 401
