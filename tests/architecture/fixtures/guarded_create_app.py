"""The positive control for `create_app_calls_missing_keywords`: a call naming all three
required keywords, the shape every real test must use (the plan's invariant)."""

from app.main import create_app
from app.settings import Settings
from tests.conftest import NOW, MovableClock
from tests.fakes.telegram import FakeTelegram

create_app(
    Settings(secret_key="x", database_url="sqlite://"),
    clock=MovableClock(NOW),
    telegram=FakeTelegram(),
    upkeep_ticker=False,
)
