"""A wrapper of `create_app` whose `clock` parameter has a default: a caller can leave
it out, so the guard refuses it even when the wrapper is listed."""

from datetime import UTC, datetime

from app.clock import Clock
from app.main import create_app
from app.settings import Settings


def _fixed() -> datetime:
    return datetime(2026, 1, 1, tzinfo=UTC)


def make_app(clock: Clock = _fixed) -> object:
    return create_app(Settings(secret_key="x", database_url="sqlite://"), clock=clock)
