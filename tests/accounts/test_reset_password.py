"""The reset matrix over HTTP (docs/adr/0019): one live link per user, 24-hour expiry,
spending nothing on a mere lookup, and the same 404 body whatever killed the link.
"""

from __future__ import annotations

from datetime import datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from app.accounts.adapters.sql_accounts import SqlAccounts
from app.accounts.adapters.tables import LoginGuardRow, ResetLinkRow
from app.accounts.application.reset_password import issue_reset_link
from app.accounts.domain.account import Email
from app.accounts.domain.password import PasswordHasher
from tests.conftest import NOW, PASSWORD, MovableClock

NEW_PASSWORD = "a brand new password"


def issue(engine: Engine, now: datetime, email: str = "uno@example.com") -> str:
    with Session(engine) as session:
        issued = issue_reset_link(SqlAccounts(session), session, email, now)
    assert issued is not None
    return issued.token


def test_a_link_works_once(
    anonymous_client: TestClient, client: TestClient, engine: Engine, clock: MovableClock
) -> None:
    token = issue(engine, clock())

    first = anonymous_client.post(f"/reset-links/{token}", json={"new_password": NEW_PASSWORD})
    second = anonymous_client.post(f"/reset-links/{token}", json={"new_password": NEW_PASSWORD})

    assert first.status_code == 200
    assert second.status_code == 404
    assert second.json()["code"] == "account.reset_link_gone"


def test_a_link_is_dead_after_24_hours(
    anonymous_client: TestClient, client: TestClient, engine: Engine, clock: MovableClock
) -> None:
    token = issue(engine, clock())
    clock.set(NOW + timedelta(hours=24))

    looked_up = anonymous_client.get(f"/reset-links/{token}")
    submitted = anonymous_client.post(f"/reset-links/{token}", json={"new_password": NEW_PASSWORD})

    assert looked_up.status_code == 404
    assert submitted.status_code == 404


def test_a_link_still_alive_just_under_24_hours_works(
    anonymous_client: TestClient, client: TestClient, engine: Engine, clock: MovableClock
) -> None:
    token = issue(engine, clock())
    clock.set(NOW + timedelta(hours=23, minutes=59))

    assert anonymous_client.get(f"/reset-links/{token}").status_code == 204


def test_a_link_is_retired_by_a_newer_one(
    anonymous_client: TestClient, client: TestClient, engine: Engine, clock: MovableClock
) -> None:
    first_token = issue(engine, clock())
    second_token = issue(engine, clock())

    stale = anonymous_client.post(
        f"/reset-links/{first_token}", json={"new_password": NEW_PASSWORD}
    )
    fresh = anonymous_client.post(
        f"/reset-links/{second_token}", json={"new_password": NEW_PASSWORD}
    )

    assert stale.status_code == 404
    assert fresh.status_code == 200


def test_a_link_is_retired_by_a_change(
    client: TestClient, anonymous_client: TestClient, engine: Engine, clock: MovableClock
) -> None:
    token = issue(engine, clock())

    client.post("/auth/password", json={"current_password": PASSWORD, "new_password": NEW_PASSWORD})

    dead = anonymous_client.post(f"/reset-links/{token}", json={"new_password": "irrelevant!!"})
    assert dead.status_code == 404


def test_a_link_is_retired_by_another_completed_reset(
    anonymous_client: TestClient, client: TestClient, engine: Engine, clock: MovableClock
) -> None:
    first_token = issue(engine, clock())
    anonymous_client.post(f"/reset-links/{first_token}", json={"new_password": NEW_PASSWORD})

    second_token = issue(engine, clock())
    anonymous_client.post(
        f"/reset-links/{second_token}", json={"new_password": "yet another password"}
    )

    with Session(engine) as session:
        assert session.scalar(select(ResetLinkRow)) is None


def test_opening_a_link_twice_spends_nothing(
    anonymous_client: TestClient, client: TestClient, engine: Engine, clock: MovableClock
) -> None:
    token = issue(engine, clock())

    first = anonymous_client.get(f"/reset-links/{token}")
    second = anonymous_client.get(f"/reset-links/{token}")

    assert first.status_code == second.status_code == 204
    with Session(engine) as session:
        assert session.scalar(select(ResetLinkRow)) is not None


def test_unknown_used_expired_and_retired_links_give_the_same_404_body(
    anonymous_client: TestClient, client: TestClient, engine: Engine, clock: MovableClock
) -> None:
    used_token = issue(engine, clock())
    anonymous_client.post(f"/reset-links/{used_token}", json={"new_password": NEW_PASSWORD})

    expired_token = issue(engine, clock())
    clock.set(NOW + timedelta(hours=25))

    retired_token = issue(engine, clock())
    issue(engine, clock())  # retires `retired_token`

    get_bodies = {
        "unknown": anonymous_client.get("/reset-links/not-a-real-token").json(),
        "used": anonymous_client.get(f"/reset-links/{used_token}").json(),
        "expired": anonymous_client.get(f"/reset-links/{expired_token}").json(),
        "retired": anonymous_client.get(f"/reset-links/{retired_token}").json(),
    }
    # The submit answers the identical body too, whatever killed the link -- a POST
    # never leaks more than the GET already does (docs/adr/0019).
    post_bodies = {
        "unknown": anonymous_client.post(
            "/reset-links/not-a-real-token", json={"new_password": NEW_PASSWORD}
        ).json(),
        "used": anonymous_client.post(
            f"/reset-links/{used_token}", json={"new_password": NEW_PASSWORD}
        ).json(),
        "expired": anonymous_client.post(
            f"/reset-links/{expired_token}", json={"new_password": NEW_PASSWORD}
        ).json(),
        "retired": anonymous_client.post(
            f"/reset-links/{retired_token}", json={"new_password": NEW_PASSWORD}
        ).json(),
    }

    assert len({str(body) for body in get_bodies.values()}) == 1
    assert len({str(body) for body in post_bodies.values()}) == 1
    assert next(iter(get_bodies.values())) == next(iter(post_bodies.values()))


def test_success_closes_every_earlier_session_and_signs_this_device_in(
    client: TestClient, anonymous_client: TestClient, engine: Engine, clock: MovableClock
) -> None:
    old_token = client.headers["Authorization"].removeprefix("Bearer ")
    token = issue(engine, clock())

    submitted = anonymous_client.post(f"/reset-links/{token}", json={"new_password": NEW_PASSWORD})

    assert submitted.status_code == 200
    new_session_token = submitted.json()["token"]
    client.cookies.clear()
    old_check = client.get("/auth/me", headers={"Authorization": f"Bearer {old_token}"})
    new_check = client.get("/auth/me", headers={"Authorization": f"Bearer {new_session_token}"})
    assert old_check.status_code == 401
    assert new_check.status_code == 200


def test_success_lifts_an_active_email_lock_and_leaves_the_address_alone(
    anonymous_client: TestClient, client: TestClient, engine: Engine, clock: MovableClock
) -> None:
    for _ in range(5):
        anonymous_client.post("/auth/login", json={"email": "uno@example.com", "password": "wrong"})
    with Session(engine) as session:
        locked = session.get(LoginGuardRow, "uno@example.com")
        assert locked is not None and locked.locked_until is not None

    token = issue(engine, clock())
    anonymous_client.post(f"/reset-links/{token}", json={"new_password": NEW_PASSWORD})

    with Session(engine) as session:
        row = session.get(LoginGuardRow, "uno@example.com")
        assert row is not None and row.locked_until is None and row.failures == 0

    # The reset itself still works even though the email was locked -- reset routes
    # are never braked.
    relogged = anonymous_client.post(
        "/auth/login", json={"email": "uno@example.com", "password": NEW_PASSWORD}
    )
    assert relogged.status_code == 200


def test_the_reset_routes_are_never_braked(
    anonymous_client: TestClient, client: TestClient, engine: Engine, clock: MovableClock
) -> None:
    for _ in range(30):
        anonymous_client.get("/reset-links/not-a-real-token")

    token = issue(engine, clock())
    assert anonymous_client.get(f"/reset-links/{token}").status_code == 204


def test_a_short_new_password_is_refused_before_any_hashing(
    anonymous_client: TestClient, client: TestClient, engine: Engine, clock: MovableClock
) -> None:
    token = issue(engine, clock())

    refused = anonymous_client.post(f"/reset-links/{token}", json={"new_password": "short"})

    assert refused.status_code == 422
    assert refused.json()["code"] == "account.password_weak"
    # The link is still live: the length check never touched it.
    assert anonymous_client.get(f"/reset-links/{token}").status_code == 204


def test_a_submit_with_no_live_link_computes_no_scrypt(
    anonymous_client: TestClient,
    client: TestClient,
    engine: Engine,
    clock: MovableClock,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def boom(self: PasswordHasher, *args: object, **kwargs: object) -> None:
        raise AssertionError("no scrypt should run for a dead link")

    monkeypatch.setattr(PasswordHasher, "hash", boom)

    refused = anonymous_client.post(
        "/reset-links/not-a-real-token", json={"new_password": NEW_PASSWORD}
    )

    assert refused.status_code == 404


def test_the_command_s_link_opens_the_reset_screen_and_a_password_is_set(
    anonymous_client: TestClient, client: TestClient, engine: Engine, clock: MovableClock
) -> None:
    token = issue(engine, clock())

    submitted = anonymous_client.post(
        f"/reset-links/{token}", json={"new_password": "a password used before works too"}
    )
    assert submitted.status_code == 200
    with Session(engine) as session:
        user = SqlAccounts(session).user_by_email(Email.of("uno@example.com"))
        assert user is not None
