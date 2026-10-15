"""The positive control for `create_app_calls_without_clock_that_open_businesses`: the
same module with the app on the frozen clock the invitation was issued at."""

from app.main import create_app
from app.settings import Settings
from tests.conftest import NOW, MovableClock, invite

create_app(Settings(secret_key="x", database_url="sqlite://"), clock=MovableClock(NOW))
ISSUES_INVITATIONS = invite
