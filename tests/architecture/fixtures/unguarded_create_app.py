"""The negative control for `create_app_calls_missing_keywords`: a call that names
neither `telegram` nor `upkeep_ticker`, the shape that let the real `HttpTelegram` and
the day-change ticker slip into a test app (Tech Lead: review integration, blocking)."""

from app.main import create_app
from app.settings import Settings

create_app(Settings(secret_key="x", database_url="sqlite://"))
