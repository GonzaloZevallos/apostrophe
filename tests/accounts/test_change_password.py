"""`POST /auth/password` (docs/adr/0019): the fixed order of checks (lock, length,
verify, success), the fresh session it hands the acting device, and that it counts for
the login brake exactly as a login does.
"""

from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from app.accounts.adapters.tables import LoginAddressGuardRow, LoginGuardRow, ResetLinkRow
from tests.conftest import NOW, PASSWORD, MovableClock, open_business

NEW_PASSWORD = "a brand new password"


@contextmanager
def peer(app: FastAPI, host: str) -> Iterator[TestClient]:
    with TestClient(app, client=(host, 12345)) as test_client:
        yield test_client


def test_success_answers_a_working_fresh_token_and_closes_the_others(
    client: TestClient,
) -> None:
    old_token = client.headers["Authorization"].removeprefix("Bearer ")

    changed = client.post(
        "/auth/password",
        json={"current_password": PASSWORD, "new_password": NEW_PASSWORD},
    )

    assert changed.status_code == 200
    new_token = changed.json()["token"]
    assert new_token != old_token

    client.cookies.clear()
    old_check = client.get("/auth/me", headers={"Authorization": f"Bearer {old_token}"})
    new_check = client.get("/auth/me", headers={"Authorization": f"Bearer {new_token}"})
    assert old_check.status_code == 401
    assert new_check.status_code == 200


def test_a_partner_s_token_still_works_after_another_user_s_change(
    client: TestClient, app: FastAPI
) -> None:
    issued = client.post("/invitations").json()["url"].rsplit("/", 1)[-1]
    with TestClient(app) as anon:
        accepted = anon.post(
            f"/invitations/{issued}/accept",
            json={"email": "socio@example.com", "password": PASSWORD},
        )
    partner_token = accepted.json()["token"]

    client.post(
        "/auth/password",
        json={"current_password": PASSWORD, "new_password": NEW_PASSWORD},
    )

    partner_check = client.get("/auth/me", headers={"Authorization": f"Bearer {partner_token}"})
    assert partner_check.status_code == 200


def test_the_same_password_is_accepted_and_still_closes_other_sessions(
    client: TestClient,
) -> None:
    old_token = client.headers["Authorization"].removeprefix("Bearer ")

    changed = client.post(
        "/auth/password", json={"current_password": PASSWORD, "new_password": PASSWORD}
    )

    assert changed.status_code == 200
    client.cookies.clear()
    old_check = client.get("/auth/me", headers={"Authorization": f"Bearer {old_token}"})
    assert old_check.status_code == 401


def test_wrong_current_password_counts_for_both_brakes(
    app: FastAPI, engine: Engine, clock: MovableClock
) -> None:
    with peer(app, "203.0.113.21") as test_client:
        open_business(test_client, engine, clock, "Primer Negocio", "cambio@example.com")

        refused = test_client.post(
            "/auth/password",
            json={"current_password": "not it", "new_password": NEW_PASSWORD},
        )

    assert refused.status_code == 422
    assert refused.json()["code"] == "account.current_password_wrong"
    with Session(engine) as session:
        email_row = session.get(LoginGuardRow, "cambio@example.com")
        address_row = session.scalar(select(LoginAddressGuardRow))
        assert email_row is not None and email_row.failures == 1
        assert address_row is not None and address_row.failures == 1


def test_five_wrong_attempts_then_the_right_password_answer_429(
    app: FastAPI, engine: Engine, clock: MovableClock
) -> None:
    with peer(app, "203.0.113.22") as test_client:
        open_business(test_client, engine, clock, "Primer Negocio", "brake@example.com")

        def attempt(current: str) -> int:
            return test_client.post(
                "/auth/password",
                json={"current_password": current, "new_password": NEW_PASSWORD},
            ).status_code

        statuses = [attempt("not it") for _ in range(5)]
        locked = attempt(PASSWORD)

    assert statuses == [422] * 5
    assert locked == 429


def test_under_either_lock_change_is_refused_even_with_the_right_password(
    app: FastAPI, engine: Engine, clock: MovableClock
) -> None:
    with peer(app, "203.0.113.23") as test_client:
        open_business(test_client, engine, clock, "Primer Negocio", "locked@example.com")
        for _ in range(5):
            test_client.post(
                "/auth/password",
                json={"current_password": "not it", "new_password": NEW_PASSWORD},
            )

        under_lock = test_client.post(
            "/auth/password",
            json={"current_password": PASSWORD, "new_password": NEW_PASSWORD},
        )

    assert under_lock.status_code == 429
    assert under_lock.json()["code"] == "account.login_locked"


def test_with_no_lock_a_short_new_password_answers_422_and_counts_nothing(
    app: FastAPI, engine: Engine, clock: MovableClock
) -> None:
    with peer(app, "203.0.113.24") as test_client:
        open_business(test_client, engine, clock, "Primer Negocio", "weak@example.com")

        refused = test_client.post(
            "/auth/password", json={"current_password": PASSWORD, "new_password": "short"}
        )

    assert refused.status_code == 422
    assert refused.json()["code"] == "account.password_weak"
    with Session(engine) as session:
        email_row = session.get(LoginGuardRow, "weak@example.com")
        address_row = session.scalar(select(LoginAddressGuardRow))
        assert email_row is None
        assert address_row is None


def test_a_successful_change_resets_the_email_count_and_leaves_the_address_alone(
    app: FastAPI, engine: Engine, clock: MovableClock
) -> None:
    with peer(app, "203.0.113.25") as test_client:
        open_business(test_client, engine, clock, "Primer Negocio", "reset@example.com")
        for _ in range(4):
            test_client.post(
                "/auth/password",
                json={"current_password": "not it", "new_password": NEW_PASSWORD},
            )
        ok = test_client.post(
            "/auth/password",
            json={"current_password": PASSWORD, "new_password": NEW_PASSWORD},
        )

    assert ok.status_code == 200
    with Session(engine) as session:
        email_row = session.get(LoginGuardRow, "reset@example.com")
        address_row = session.scalar(select(LoginAddressGuardRow))
        assert email_row is not None and email_row.failures == 0
        assert address_row is not None and address_row.failures == 4


def test_success_deletes_the_user_s_live_reset_link(
    client: TestClient, engine: Engine
) -> None:
    from app.accounts.adapters.sql_accounts import SqlAccounts
    from app.accounts.domain.account import Email

    with Session(engine) as session:
        accounts = SqlAccounts(session)
        user = accounts.user_by_email(Email.of("uno@example.com"))
        assert user is not None and user.id is not None
        accounts.issue_reset_link(user.id, "a" * 64, NOW)
        session.commit()

    client.post(
        "/auth/password", json={"current_password": PASSWORD, "new_password": NEW_PASSWORD}
    )

    with Session(engine) as session:
        assert session.scalar(select(ResetLinkRow)) is None


def test_under_a_lock_no_scrypt_is_computed(
    app: FastAPI, engine: Engine, clock: MovableClock, monkeypatch: pytest.MonkeyPatch
) -> None:
    from app.accounts.domain.password import PasswordHasher

    def boom(self: PasswordHasher, *args: object, **kwargs: object) -> None:
        raise AssertionError("no scrypt should run once a lock is active")

    with peer(app, "203.0.113.26") as test_client:
        open_business(test_client, engine, clock, "Primer Negocio", "noscrypt@example.com")
        for _ in range(5):
            test_client.post(
                "/auth/password",
                json={"current_password": "not it", "new_password": NEW_PASSWORD},
            )

        monkeypatch.setattr(PasswordHasher, "verify", boom)
        monkeypatch.setattr(PasswordHasher, "hash", boom)

        under_lock = test_client.post(
            "/auth/password",
            json={"current_password": PASSWORD, "new_password": NEW_PASSWORD},
        )

    assert under_lock.status_code == 429


def test_another_business_s_change_leaves_this_business_s_session_working(
    client: TestClient, other_client: TestClient
) -> None:
    """Isolation (CODING_STANDARDS §9): `other_client`'s own Change takes its user
    only from its own session, so it can never touch `client`'s business or token."""
    me_before = client.get("/auth/me").json()

    changed = other_client.post(
        "/auth/password",
        json={"current_password": PASSWORD, "new_password": NEW_PASSWORD},
    )

    assert changed.status_code == 200
    assert client.get("/auth/me").json() == me_before


def test_the_route_never_answers_401_except_through_the_session(client: TestClient) -> None:
    refused = client.post(
        "/auth/password", json={"current_password": "not it", "new_password": NEW_PASSWORD}
    )
    assert refused.status_code != 401
