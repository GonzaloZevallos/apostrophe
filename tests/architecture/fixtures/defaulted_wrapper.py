"""A wrapper of `create_app` whose `clock` parameter has a default: a caller can leave
it out, so the guard refuses it even when the wrapper is listed."""

from app.clock import Clock, system_clock
from app.main import create_app
from app.settings import Settings


def make_app(clock: Clock = system_clock) -> object:
    return create_app(Settings(secret_key="x", database_url="sqlite://"), clock=clock)
