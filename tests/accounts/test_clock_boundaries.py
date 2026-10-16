"""Accept, login and `GET /auth/me` give the same verdicts whatever the day (accounts.md
criterion 37; docs/adr/0001: the clock is injected, business time is Argentina, UTC-3).

One `MovableClock` issues the invitation (`invite(engine, clock())`) and runs inside the
app, so the verdict depends on the offsets between instants and never on the date the suite
runs on. `tests/business_removal/adapters/test_cli.py::
test_a_real_run_exports_then_deletes_and_leaves_the_other_business_whole` already moves the
clock across a month and a year boundary for the removal flow; this file covers only
accept, login and `/auth/me`."""

from datetime import UTC, date, datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.engine import Engine

from app.accounts.domain.invitation import INVITATION_LIFETIME
from tests.conftest import NOW, PASSWORD, MovableClock, invite

ARGENTINA = timezone(timedelta(hours=-3))
NEW_USER = {"email": "nueva@example.com", "password": PASSWORD, "business_name": "La Huerta"}


def _open_and_sign_in(
    client: TestClient, engine: Engine, clock: MovableClock, issued: datetime, accepted: datetime
) -> tuple[int, int, int, str | None]:
    """Issues at `issued`, accepts and logs in at `accepted`: the accept status, the login
    status, `/auth/me`'s status and its `today`."""
    clock.set(issued)
    token = invite(engine, clock())
    clock.set(accepted)
    accept = client.post(f"/invitations/{token}/accept", json=NEW_USER)
    login = client.post(
        "/auth/login", json={"email": NEW_USER["email"], "password": NEW_USER["password"]}
    )
    if login.status_code != 200:
        return accept.status_code, login.status_code, 0, None
    me = client.get("/auth/me", headers={"Authorization": f"Bearer {login.json()['token']}"})
    return accept.status_code, login.status_code, me.status_code, me.json().get("today")


@pytest.mark.parametrize(
    ("instant", "today"),
    [
        pytest.param(
            datetime(2026, 12, 31, 23, 30, tzinfo=ARGENTINA), date(2026, 12, 31), id="31/12 23:30"
        ),
        pytest.param(
            datetime(2027, 1, 1, 0, 30, tzinfo=ARGENTINA), date(2027, 1, 1), id="01/01 00:30"
        ),
    ],
)
def test_the_argentina_day_edge_decides_today_and_nothing_else(
    anonymous_client: TestClient,
    engine: Engine,
    clock: MovableClock,
    instant: datetime,
    today: date,
) -> None:
    result = _open_and_sign_in(anonymous_client, engine, clock, instant, instant)

    assert result == (201, 200, 200, today.isoformat())


# (issued, accepted): month end, year end, and the same offsets from conftest's NOW.
SIX_DAYS = timedelta(days=6)
SIX_AND_A_HALF = timedelta(days=6, hours=12, minutes=30)
ISSUED_MONTH = datetime(2026, 10, 28, 12, 0, tzinfo=ARGENTINA)
ISSUED_YEAR = datetime(2026, 12, 28, 12, 0, tzinfo=ARGENTINA)
INSIDE_THE_LIFETIME = [
    pytest.param(ISSUED_MONTH, datetime(2026, 11, 3, 12, 0, tzinfo=ARGENTINA), id="month end"),
    pytest.param(ISSUED_YEAR, datetime(2027, 1, 4, 0, 30, tzinfo=ARGENTINA), id="year end"),
    pytest.param(NOW, NOW + SIX_DAYS, id="baseline, month offset"),
    pytest.param(NOW, NOW + SIX_AND_A_HALF, id="baseline, year offset"),
]


@pytest.mark.parametrize(("issued", "accepted"), INSIDE_THE_LIFETIME)
def test_an_invitation_accepted_inside_its_lifetime_opens_a_session_on_any_day(
    anonymous_client: TestClient,
    engine: Engine,
    clock: MovableClock,
    issued: datetime,
    accepted: datetime,
) -> None:
    assert accepted - issued < INVITATION_LIFETIME
    accept, login, me, today = _open_and_sign_in(anonymous_client, engine, clock, issued, accepted)

    assert (accept, login, me) == (201, 200, 200)
    assert today == (accepted.astimezone(ARGENTINA)).date().isoformat()


# (issued, accepted): `accepted` is `issued` + 7 days + 1 second, written out.
JUST_PAST_THE_LIFETIME = [
    pytest.param(ISSUED_MONTH, datetime(2026, 11, 4, 12, 0, 1, tzinfo=ARGENTINA), id="month end"),
    pytest.param(ISSUED_YEAR, datetime(2027, 1, 4, 12, 0, 1, tzinfo=ARGENTINA), id="year end"),
    pytest.param(NOW, datetime(2026, 10, 9, 18, 0, 1, tzinfo=UTC), id="NOW"),
]


@pytest.mark.parametrize(("issued", "accepted"), JUST_PAST_THE_LIFETIME)
def test_an_invitation_accepted_just_past_its_lifetime_is_refused_on_any_day(
    anonymous_client: TestClient,
    engine: Engine,
    clock: MovableClock,
    issued: datetime,
    accepted: datetime,
) -> None:
    assert accepted - issued == INVITATION_LIFETIME + timedelta(seconds=1)

    accept, login, _me, _today = _open_and_sign_in(
        anonymous_client, engine, clock, issued, accepted
    )

    assert (accept, login) == (404, 401)
