"""A test function whose `clock` parameter has a default: it is not the fixture pytest
always supplies, so the guard refuses it."""

from datetime import UTC, datetime

from app.clock import Clock
from app.main import create_app
from app.settings import Settings


def _fixed() -> datetime:
    return datetime(2026, 1, 1, tzinfo=UTC)


def test_it(clock: Clock = _fixed) -> None:
    create_app(Settings(secret_key="x", database_url="sqlite://"), clock=clock)
