"""Fixtures for the whole suite: a fresh in-memory database per test, a clock the test
can move, and clients signed in to two different businesses."""

from collections.abc import Iterator
from datetime import UTC, date, datetime

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from app.accounts.adapters.sql_accounts import SqlAccounts
from app.accounts.application.invitations import invite_new_business
from app.accounts.domain.password import PasswordHasher, ScryptParams
from app.db import make_engine
from app.main import create_app
from app.settings import Settings
from tests.fakes.telegram import FakeTelegram

# 2026-10-02 15:00 in Buenos Aires (UTC-3). Tests reason about "today" from here.
NOW = datetime(2026, 10, 2, 18, 0, tzinfo=UTC)
TODAY = date(2026, 10, 2)
PASSWORD = "correct horse battery staple"
SETTINGS = Settings(secret_key="test-secret-key", database_url="sqlite://")
# Cheap enough for a suite that opens two businesses per test; never used outside tests.
TEST_HASHER = PasswordHasher(ScryptParams(n=16, r=1, p=1))


class MovableClock:
    def __init__(self, instant: datetime) -> None:
        self._instant = instant

    def __call__(self) -> datetime:
        return self._instant

    def set(self, instant: datetime) -> None:
        self._instant = instant


def invite(engine: Engine, now: datetime) -> str:
    """A new-business invitation, issued the way `scripts/invite-business.sh` does."""
    with Session(engine) as session:
        return invite_new_business(SqlAccounts(session), session, now).token


def open_business(
    client: TestClient, engine: Engine, clock: MovableClock, name: str, email: str
) -> str:
    """Opens a business the way a new user does, over HTTP, and answers its session token."""
    accepted = client.post(
        f"/invitations/{invite(engine, clock())}/accept",
        json={"business_name": name, "email": email, "password": PASSWORD},
    )
    assert accepted.status_code == 201, accepted.text
    token: str = accepted.json()["token"]
    return token


def signed_in(client: TestClient, token: str) -> TestClient:
    client.cookies.clear()
    client.headers["Authorization"] = f"Bearer {token}"
    return client


@pytest.fixture
def clock() -> MovableClock:
    return MovableClock(NOW)


@pytest.fixture
def engine() -> Iterator[Engine]:
    engine = make_engine("sqlite://")
    yield engine
    engine.dispose()


@pytest.fixture
def telegram() -> FakeTelegram:
    """The one `Telegram` the test app wires in (the plan's invariant): no test but
    `tests/pinned_catalog/test_telegram_http.py` ever constructs the real adapter."""
    return FakeTelegram()


@pytest.fixture
def app(engine: Engine, clock: MovableClock, telegram: FakeTelegram) -> FastAPI:
    return create_app(
        SETTINGS,
        engine=engine,
        clock=clock,
        hasher=TEST_HASHER,
        telegram=telegram,
        upkeep_ticker=False,
    )


@pytest.fixture
def anonymous_client(app: FastAPI) -> Iterator[TestClient]:
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def client(app: FastAPI, engine: Engine, clock: MovableClock) -> Iterator[TestClient]:
    """Signed in to a business of its own, carrying the token as a bearer header."""
    with TestClient(app) as test_client:
        token = open_business(test_client, engine, clock, "Primer Negocio", "uno@example.com")
        yield signed_in(test_client, token)


@pytest.fixture
def other_client(
    app: FastAPI, engine: Engine, clock: MovableClock, client: TestClient
) -> Iterator[TestClient]:
    """Signed in to a second business, on the same database as `client`."""
    with TestClient(app) as test_client:
        token = open_business(test_client, engine, clock, "Otro Negocio", "otro@example.com")
        yield signed_in(test_client, token)
