"""The negative control for the `clock` keyword of `create_app_calls_missing_keywords`: a
call naming `telegram` and `upkeep_ticker` but not `clock`, the shape that lets a test
mint invitations on its own clock and have the app accept them on the real one."""

from app.main import create_app
from app.settings import Settings
from tests.fakes.telegram import FakeTelegram

create_app(
    Settings(secret_key="x", database_url="sqlite://"),
    telegram=FakeTelegram(),
    upkeep_ticker=False,
)
