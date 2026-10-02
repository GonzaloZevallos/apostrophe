"""The brake on guessing passwords (docs/adr/0002): five failed logins in a row for an
email lock that email for fifteen minutes. A success resets the count. Unknown emails
are braked the same way, so the brake never tells which emails exist."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta

MAX_FAILURES = 5
LOCK_DURATION = timedelta(minutes=15)


@dataclass
class LoginGuard:
    failures: int = 0
    locked_until: datetime | None = None

    def is_locked(self, now: datetime) -> bool:
        return self.locked_until is not None and now < self.locked_until

    def record_failure(self, now: datetime) -> None:
        self.failures += 1
        if self.failures >= MAX_FAILURES:
            self.locked_until = now + LOCK_DURATION
            self.failures = 0

    def record_success(self) -> None:
        self.failures = 0
        self.locked_until = None
