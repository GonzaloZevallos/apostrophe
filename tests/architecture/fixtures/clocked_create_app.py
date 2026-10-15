"""The positive control for `create_app_clock_violations`: a call naming its clock,
the shape every real test must use. It imports the clock without reading it."""

from datetime import UTC, datetime

from app.clock import system_clock
from app.main import create_app
from app.settings import Settings

__all__ = ["system_clock"]
FIXED = datetime(2026, 1, 1, tzinfo=UTC)

create_app(Settings(secret_key="x", database_url="sqlite://"), clock=lambda: FIXED)
