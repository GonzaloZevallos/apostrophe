"""The positive control for `create_app_clock_violations`: a call naming its clock,
the shape every real test must use."""

from datetime import UTC, datetime

from app.main import create_app
from app.settings import Settings

FIXED = datetime(2026, 1, 1, tzinfo=UTC)

create_app(Settings(secret_key="x", database_url="sqlite://"), clock=lambda: FIXED)
