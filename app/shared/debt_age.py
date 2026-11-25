"""Debt age, defined once (docs/adr/20261119-*): how many whole days a debt has been
owed, and the two limits every capability buckets or levels it by. Standard library
only; `today` is always a parameter and nothing here reads a clock.
"""

from __future__ import annotations

from datetime import date

RECENT_UP_TO_DAYS = 7
WARNING_UP_TO_DAYS = 30


def age_in_days(on: date, today: date) -> int:
    """Whole days from `on` to `today`; a date in the future counts as `0`."""
    return max(0, (today - on).days)
