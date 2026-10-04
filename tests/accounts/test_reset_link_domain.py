"""`app/accounts/domain/reset_link.py`'s pure functions, with no infrastructure: the
predicate a lookup and a spend share (`live_cutoff`), and the command's own printout
(`expires_at`).
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from app.accounts.domain.reset_link import RESET_LINK_LIFETIME, expires_at, live_cutoff

NOW = datetime(2026, 10, 2, 18, 0, tzinfo=UTC)


def test_live_cutoff_is_now_minus_the_lifetime() -> None:
    assert live_cutoff(NOW) == NOW - timedelta(hours=24)
    assert live_cutoff(NOW) == NOW - RESET_LINK_LIFETIME


def test_a_link_created_at_the_cutoff_itself_is_not_live() -> None:
    """The shared predicate is `created_at > live_cutoff(now)` (docs/adr/0019): a row
    created exactly at the cutoff has gone stale, not merely about to.

    `created_at` is computed independently of `live_cutoff`, from `NOW` and
    `RESET_LINK_LIFETIME` directly: comparing `live_cutoff(NOW)` against itself would
    pass for any deterministic implementation, including a wrong one, and prove
    nothing about where the boundary actually falls.
    """
    created_at = NOW - RESET_LINK_LIFETIME

    assert not created_at > live_cutoff(NOW)


def test_a_link_created_one_second_after_the_cutoff_is_live() -> None:
    created_at = NOW - RESET_LINK_LIFETIME + timedelta(seconds=1)

    assert created_at > live_cutoff(NOW)


def test_expires_at_is_created_at_plus_the_lifetime() -> None:
    assert expires_at(NOW) == NOW + timedelta(hours=24)
