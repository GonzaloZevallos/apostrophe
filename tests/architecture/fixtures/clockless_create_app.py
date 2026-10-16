"""A negative control for `create_app_calls_missing_keywords`: a call naming `telegram` and
`upkeep_ticker` but not `clock`, the shape that lets `create_app` fall back to
`system_clock` inside a test (ADR-0043)."""

from app.main import create_app
from app.settings import Settings
from tests.fakes.telegram import FakeTelegram

create_app(
    Settings(secret_key="x", database_url="sqlite://"),
    telegram=FakeTelegram(),
    upkeep_ticker=False,
)
