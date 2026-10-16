"""The positive control for `invite_calls_passing_bare_now`: an invitation minted at the
clock the app was given."""

from app.db import make_engine
from tests.conftest import NOW, MovableClock, invite

engine = make_engine("sqlite://")
clock = MovableClock(NOW)
invite(engine, clock())
invite(engine, now=clock())
