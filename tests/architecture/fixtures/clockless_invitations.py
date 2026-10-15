"""The negative control for `create_app_calls_without_clock_that_open_businesses`: a
module that issues an invitation at the fixed `NOW` and builds its app on the system
clock, so the invitation is judged against today's date and expires (7-day lifetime)."""

from app.main import create_app
from app.settings import Settings
from tests.conftest import invite

create_app(Settings(secret_key="x", database_url="sqlite://"), upkeep_ticker=False)
ISSUES_INVITATIONS = invite
