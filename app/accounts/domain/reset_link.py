"""A reset link: a row that exists only while it could still work (docs/adr/0019).

It works once, within 24 hours of being issued. "Used" and "retired" are not states a
link can be in: a use, a newer link or any password change deletes the row outright, so
the only thing left to check is whether it is still young enough.
"""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import ClassVar

RESET_LINK_LIFETIME = timedelta(hours=24)


class ResetLinkGone(LookupError):
    """Unknown, used, expired or retired: all four look the same from outside, on
    purpose (docs/adr/0019)."""

    code: ClassVar[str] = "account.reset_link_gone"

    def __init__(self) -> None:
        super().__init__("this reset link does not exist, was used or expired")


class CurrentPasswordWrong(Exception):
    """The current password Change was given does not match the one on file."""

    code: ClassVar[str] = "account.current_password_wrong"

    def __init__(self) -> None:
        super().__init__("the current password is not right")


def live_cutoff(now: datetime) -> datetime:
    """A link created at or before this instant has gone stale: the predicate every
    lookup and spend share is `created_at > live_cutoff(now)`."""
    return now - RESET_LINK_LIFETIME


def expires_at(created_at: datetime) -> datetime:
    """When a link issued at `created_at` stops working, for the command's printout."""
    return created_at + RESET_LINK_LIFETIME
