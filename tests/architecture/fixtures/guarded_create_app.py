"""The positive control for `create_app_calls_missing_keywords`: a call naming every
required keyword, the shape every real test must use (the plan's invariant)."""

from datetime import UTC, datetime

from app.main import create_app
from app.settings import Settings
from tests.fakes.telegram import FakeTelegram

create_app(
    Settings(secret_key="x", database_url="sqlite://"),
    telegram=FakeTelegram(),
    upkeep_ticker=False,
    clock=lambda: datetime(2026, 10, 2, 18, 0, tzinfo=UTC),
)
