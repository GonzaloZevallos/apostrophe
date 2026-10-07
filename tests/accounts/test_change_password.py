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
from sqlalchemy import func, select
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

        with Session(engine) as session:
            email_before = session.get(LoginGuardRow, "locked@example.com")
            address_before = session.scalar(select(LoginAddressGuardRow))
            email_failures_before = email_before.failures if email_before is not None else 0
            address_failures_before = address_before.failures if address_before is not None else 0

        under_lock = test_client.post(
            "/auth/password",
            json={"current_password": PASSWORD, "new_password": NEW_PASSWORD},
        )

    assert under_lock.status_code == 429
    assert under_lock.json()["code"] == "account.login_locked"
    with Session(engine) as session:
        email_after = session.get(LoginGuardRow, "locked@example.com")
        address_after = session.scalar(select(LoginAddressGuardRow))
        assert email_after is not None and email_after.failures == email_failures_before + 1
        assert address_after is not None and address_after.failures == address_failures_before + 1


def test_under_the_email_lock_alone_a_short_new_password_still_answers_429_and_counts_both(
    app: FastAPI, engine: Engine, clock: MovableClock
) -> None:
    """Five wrong Change attempts from five different addresses lock the email alone
    (each address, used once, never nears its own threshold of 20). A sixth, fresh
    address then finds the email locked and is refused before the password's length
    is even looked at (the lock comes first in the fixed order); that refusal still
    counts for both brakes, including this fresh address's own count."""
    with peer(app, "203.0.113.31") as owner:
        token = open_business(owner, engine, clock, "Primer Negocio", "elock@example.com")

    for n in range(5):
        with peer(app, f"203.0.113.{40 + n}") as attacker:
            attacker.headers["Authorization"] = f"Bearer {token}"
            attacker.post(
                "/auth/password",
                json={"current_password": "not it", "new_password": NEW_PASSWORD},
            )

    with peer(app, "203.0.113.50") as fresh:
        fresh.headers["Authorization"] = f"Bearer {token}"
        under_lock = fresh.post(
            "/auth/password",
            json={"current_password": PASSWORD, "new_password": "short"},
        )

    assert under_lock.status_code == 429
    assert under_lock.json()["code"] == "account.login_locked"
    with Session(engine) as session:
        email_row = session.get(LoginGuardRow, "elock@example.com")
        # The 5th attempt reached the email's own threshold and locked it, which
        # subtracts that threshold from the visible count (so counts during a lock
        # stay in force once it opens) rather than zeroing it outright -- so the
        # count lands back near zero, then this 6th, already-locked attempt still
        # adds its own one (the plan invariant: counting never stops under a lock).
        assert email_row is not None and email_row.failures == 1
        assert email_row.locked_until is not None
        total_address_failures = session.scalar(
            select(func.sum(LoginAddressGuardRow.failures))
        )
        assert total_address_failures == 6


@pytest.mark.parametrize("new_password", ["short", NEW_PASSWORD], ids=["short", "right"])
def test_under_the_address_lock_alone_change_answers_429_and_counts_both_whatever_the_new_password(
    app: FastAPI,
    engine: Engine,
    clock: MovableClock,
    monkeypatch: pytest.MonkeyPatch,
    new_password: str,
) -> None:
    """Twenty failed, unrelated logins from one address lock that address alone (no
    single one of those emails nears its own threshold). A Change from the same
    address, with the right current password and whatever the new password, still
    finds the address locked first and is refused -- counting against both the
    address and this user's own, still-unlocked email, with no scrypt computed."""
    from app.accounts.domain.password import PasswordHasher

    def boom(self: PasswordHasher, *args: object, **kwargs: object) -> None:
        raise AssertionError("no scrypt should run once a lock is active")

    host = "203.0.113.60"
    with peer(app, host) as test_client:
        token = open_business(test_client, engine, clock, "Primer Negocio", "alock@example.com")

        for n in range(20):
            test_client.post(
                "/auth/login", json={"email": f"nadie{n}@example.com", "password": "x"}
            )

        test_client.headers["Authorization"] = f"Bearer {token}"

        with Session(engine) as session:
            email_before = session.get(LoginGuardRow, "alock@example.com")
            address_before = session.scalar(select(LoginAddressGuardRow))
            email_failures_before = email_before.failures if email_before is not None else 0
            address_failures_before = address_before.failures if address_before is not None else 0

        monkeypatch.setattr(PasswordHasher, "hash", boom)
        monkeypatch.setattr(PasswordHasher, "verify", boom)
        monkeypatch.setattr(PasswordHasher, "burn", boom)

        under_lock = test_client.post(
            "/auth/password",
            json={"current_password": PASSWORD, "new_password": new_password},
        )

    assert under_lock.status_code == 429
    assert under_lock.json()["code"] == "account.login_locked"
    with Session(engine) as session:
        email_after = session.get(LoginGuardRow, "alock@example.com")
        address_after = session.scalar(select(LoginAddressGuardRow))
        assert email_after is not None and email_after.failures == email_failures_before + 1
        assert address_after is not None and address_after.failures == address_failures_before + 1


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
        monkeypatch.setattr(PasswordHasher, "burn", boom)

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
