"""The negative control for `invite_calls_passing_bare_now`: an invitation minted at the
fixed `NOW`, positionally and by keyword."""

from app.db import make_engine
from tests.conftest import NOW, invite

engine = make_engine("sqlite://")
invite(engine, NOW)
invite(engine, now=NOW)
