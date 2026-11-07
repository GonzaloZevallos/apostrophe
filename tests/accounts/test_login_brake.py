"""The login brake over HTTP (docs/adr/0002): the per-email brake unchanged, the new
per-address brake, their cross-counting (refusals under an active lock included), and
that neither ever discloses a count, an address or which brake fired.

Each simulated client address is a distinct peer (`TestClient(app, client=(host, _))`)
— `SETTINGS.trusted_proxies` is empty, so `ClientAddress` always takes the peer, never
a header, exactly as it does on the home network.

Reaching a threshold locks the *next* request, never the one that reaches it (as the
existing per-email test in `tests/accounts/test_accounts_api.py` already shows: five
wrong passwords are all 401, and only the sixth answers 429). Every test below counts
requests with that in mind.
"""

from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager
from datetime import timedelta

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from app.accounts.adapters.tables import LoginGuardRow
from tests.conftest import NOW, PASSWORD, MovableClock

RIGHT = {"email": "uno@example.com", "password": PASSWORD}
WRONG = {"email": "uno@example.com", "password": "wrong password"}


@contextmanager
def peer(app: FastAPI, host: str) -> Iterator[TestClient]:
    with TestClient(app, client=(host, 12345)) as test_client:
        yield test_client


def login(app: FastAPI, host: str, body: dict[str, str]) -> int:
    with peer(app, host) as test_client:
        return test_client.post("/auth/login", json=body).status_code


@pytest.fixture(autouse=True)
def _signed_up(client: TestClient) -> None:
    """`client` (tests/conftest.py) opens "Primer Negocio" for uno@example.com with
    `PASSWORD` — every test here only needs that account to exist."""


def test_one_email_tried_from_many_peers_locks_it_the_brake_is_unaffected_by_the_peer(
    app: FastAPI,
) -> None:
    statuses = [login(app, f"203.0.113.{n}", WRONG) for n in range(1, 6)]
    locked = login(app, "203.0.113.99", RIGHT)

    assert statuses == [401] * 5
    assert locked == 429


def test_twenty_failures_from_one_peer_across_many_emails_lock_the_address(
    app: FastAPI,
) -> None:
    """Twenty different, unknown emails tried from the same peer lock that address,
    even though no single email ever nears its own threshold."""
    with peer(app, "198.51.100.9") as test_client:
        statuses = [
            test_client.post(
                "/auth/login", json={"email": f"nadie{n}@example.com", "password": "x"}
            ).status_code
            for n in range(20)
        ]
        locked = test_client.post(
            "/auth/login", json={"email": "otro@example.com", "password": "x"}
        ).status_code

    assert statuses == [401] * 20
    assert locked == 429


def test_failures_spread_beyond_the_window_do_not_lock_the_address(
    app: FastAPI, clock: MovableClock
) -> None:
    """19 failures, then the clock past the window, then *two* more: if the window
    had not reset, the first of those two would already be the 20th failure overall
    (still answering 401, reaching-threshold's own request always does) and the
    second would find the address locked (429). Both answering 401 is only possible
    if the window reset and restarted the count near zero."""
    with peer(app, "198.51.100.10") as test_client:
        for n in range(19):
            body = {"email": f"nadie{n}@example.com", "password": "x"}
            assert test_client.post("/auth/login", json=body).status_code == 401

        clock.set(NOW + timedelta(minutes=16))
        first_after_the_window = test_client.post(
            "/auth/login", json={"email": "nadie19@example.com", "password": "x"}
        )
        second_after_the_window = test_client.post(
            "/auth/login", json={"email": "nadie20@example.com", "password": "x"}
        )

    assert first_after_the_window.status_code == 401
    assert second_after_the_window.status_code == 401


def test_cross_counting_includes_refusals_under_an_active_lock(app: FastAPI) -> None:
    """Locking the email first, then hammering it with the right password, still
    counts every one of those refusals against the address — proven by two fresh,
    never-tried emails afterwards: the first still finds the address under its own
    threshold (401), the second finds it just pushed over (429)."""
    host = "198.51.100.20"
    with peer(app, host) as test_client:
        for _ in range(5):
            test_client.post("/auth/login", json=WRONG)
        under_lock = [test_client.post("/auth/login", json=WRONG).status_code for _ in range(15)]
        probe_c = test_client.post(
            "/auth/login", json={"email": "c@example.com", "password": "x"}
        ).status_code
        probe_d = test_client.post(
            "/auth/login", json={"email": "d@example.com", "password": "x"}
        ).status_code

    assert under_lock == [429] * 15
    assert probe_c == 401
    assert probe_d == 429


def test_a_success_resets_only_the_email_s_count_never_the_address_s(app: FastAPI) -> None:
    host = "198.51.100.30"
    with peer(app, host) as test_client:
        for _ in range(4):
            test_client.post("/auth/login", json=WRONG)
        ok = test_client.post("/auth/login", json=RIGHT)
        # The count was reset to zero; five fresh failures are needed to lock again.
        again = [test_client.post("/auth/login", json=WRONG).status_code for _ in range(5)]
        sixth = test_client.post("/auth/login", json=WRONG)

    assert ok.status_code == 200
    assert again == [401] * 5
    assert sixth.status_code == 429


def test_a_key_locked_at_t_and_hammered_throughout_opens_at_t_plus_fifteen_minutes(
    app: FastAPI, clock: MovableClock
) -> None:
    host = "198.51.100.40"
    with peer(app, host) as test_client:
        for _ in range(5):
            test_client.post("/auth/login", json=WRONG)
        assert test_client.post("/auth/login", json=RIGHT).status_code == 429

        clock.set(NOW + timedelta(minutes=14, seconds=59))
        still_locked = test_client.post("/auth/login", json=RIGHT)

        clock.set(NOW + timedelta(minutes=15))
        opened = test_client.post("/auth/login", json=RIGHT)

    assert still_locked.status_code == 429
    assert opened.status_code == 200


def test_counts_accumulated_during_a_lock_are_in_force_once_it_opens(
    app: FastAPI, clock: MovableClock
) -> None:
    """Hammering a locked email keeps counting; once the lock opens, that count is
    not thrown away, so a single further failure locks it again right away, rather
    than needing five fresh ones."""
    host = "198.51.100.50"
    with peer(app, host) as test_client:
        for _ in range(5):
            test_client.post("/auth/login", json=WRONG)
        for _ in range(7):
            test_client.post("/auth/login", json=WRONG)

        clock.set(NOW + timedelta(minutes=15))
        one_more_failure = test_client.post("/auth/login", json=WRONG)
        confirmed_locked = test_client.post("/auth/login", json=WRONG)

    assert one_more_failure.status_code == 401
    assert confirmed_locked.status_code == 429


def test_both_locks_answer_the_identical_429_body(app: FastAPI) -> None:
    with peer(app, "203.0.113.60") as email_locked_client:
        for _ in range(5):
            email_locked_client.post("/auth/login", json=WRONG)
        from_email_lock = email_locked_client.post("/auth/login", json=RIGHT)

    with peer(app, "198.51.100.60") as address_locked_client:
        for n in range(20):
            address_locked_client.post(
                "/auth/login", json={"email": f"nadie{n}@example.com", "password": "x"}
            )
        from_address_lock = address_locked_client.post(
            "/auth/login", json={"email": "nadie99@example.com", "password": "x"}
        )

    assert from_email_lock.status_code == from_address_lock.status_code == 429
    assert from_email_lock.json() == from_address_lock.json()


def test_a_malformed_email_leaves_no_login_guard_row_and_counts_the_address(
    app: FastAPI, engine: Engine
) -> None:
    malformed = "not an email"
    with peer(app, "198.51.100.70") as test_client:
        statuses = [
            test_client.post("/auth/login", json={"email": malformed, "password": "x"}).status_code
            for _ in range(20)
        ]
        locked = test_client.post(
            "/auth/login", json={"email": malformed, "password": "x"}
        ).status_code

    assert statuses == [401] * 20
    assert locked == 429
    with Session(engine) as session:
        rows = session.scalars(select(LoginGuardRow)).all()
        assert all(row.email != malformed for row in rows)


def test_no_log_line_from_the_login_path_carries_an_address_an_email_or_a_token(
    app: FastAPI, caplog: pytest.LogCaptureFixture
) -> None:
    secrets = ("uno@example.com", "203.0.113.80", PASSWORD)
    with caplog.at_level("DEBUG"):
        with peer(app, "203.0.113.80") as test_client:
            for _ in range(6):
                test_client.post("/auth/login", json=WRONG)
            test_client.post("/auth/login", json={"email": "not an email", "password": "x"})

    for record in caplog.records:
        message = record.getMessage()
        assert all(secret not in message for secret in secrets)
