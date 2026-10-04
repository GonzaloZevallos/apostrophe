"""The brake on guessing passwords (docs/adr/0002): five failed logins in a row for an
email lock that email for fifteen minutes, and twenty failed logins in a fixed
fifteen-minute window from one client address lock that address for fifteen minutes.
A success resets only the email's count, never the address's. Unknown emails are
braked the same way, so the brake never tells which emails exist.

Both guards are pure: they hold no connection and do no counting themselves — the
counts are atomic SQL upserts (`SqlAccounts`), and these two classes only say when a
count locks and when a lock has opened. The thresholds, the window and the lock
duration live only here (plan invariant: no literal for them anywhere under
app/accounts/adapters/).
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta

MAX_FAILURES = 5
MAX_ADDRESS_FAILURES = 20
ADDRESS_WINDOW = timedelta(minutes=15)
LOCK_DURATION = timedelta(minutes=15)


@dataclass(frozen=True)
class LoginGuard:
    """The per-email brake: `MAX_FAILURES` in a row lock the email for `LOCK_DURATION`."""

    locked_until: datetime | None = None

    def is_locked(self, now: datetime) -> bool:
        return self.locked_until is not None and now < self.locked_until

    def lock_until(self, now: datetime) -> datetime:
        return now + LOCK_DURATION

    def reached(self, failures: int) -> bool:
        return failures >= MAX_FAILURES


@dataclass(frozen=True)
class AddressGuard:
    """The per-address brake: `MAX_ADDRESS_FAILURES` within a fixed `ADDRESS_WINDOW`
    lock the address for `LOCK_DURATION`."""

    locked_until: datetime | None = None

    def is_locked(self, now: datetime) -> bool:
        return self.locked_until is not None and now < self.locked_until

    def lock_until(self, now: datetime) -> datetime:
        return now + LOCK_DURATION

    def reached(self, failures: int) -> bool:
        return failures >= MAX_ADDRESS_FAILURES

    def window_cutoff(self, now: datetime) -> datetime:
        """A window started at or before this instant has expired: the next failure
        starts a fresh window instead of extending the old one."""
        return now - ADDRESS_WINDOW
