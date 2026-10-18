"""The negative control for `create_app_clock_violations`: every shape of call that
leaves the app's clock unnamed. One violation per call, in this order."""

from app.clock import Clock
from app.main import create_app as build_app
from app.settings import Settings

SETTINGS = Settings(secret_key="x", database_url="sqlite://")
OPTIONS: dict[str, object] = {}

build_app(SETTINGS)
build_app(SETTINGS, clock=None)
build_app(SETTINGS, **OPTIONS)
build_app(SETTINGS, telegram=None, upkeep_ticker=False)


def make_app(clock: Clock) -> object:
    return build_app(SETTINGS, clock=clock)
