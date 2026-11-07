"""`SqlAccounts`'s brake counters, over a real file-backed SQLite database shared by
several threads (CODING_STANDARDS section 5; docs/adr/0012's guarded-write pattern,
here for a counter rather than a balance): each thread opens its own `Session` against
the same file, so a read-then-save would lose counts under contention. The atomic
upsert with `RETURNING` must not.
"""

from __future__ import annotations

from collections.abc import Iterator
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from app.accounts.adapters.sql_accounts import SqlAccounts
from app.accounts.adapters.tables import LoginGuardRow
from app.accounts.domain.account import Email
from app.accounts.domain.login_guard import AddressGuard
from app.db import make_engine
from app.migrations.runner import upgrade_to_head

NOW = datetime(2026, 10, 2, 18, 0, tzinfo=UTC)


@pytest.fixture
def file_engine(tmp_path: Path) -> Iterator[Engine]:
    engine = make_engine(f"sqlite:///{tmp_path / 'brake.db'}")
    upgrade_to_head(engine)
    yield engine
    engine.dispose()


def _count_address_failure(engine: Engine, digest: str, now: datetime, cutoff: datetime) -> int:
    with Session(engine) as session:
        failures = SqlAccounts(session).count_address_failure(digest, now, cutoff)
        session.commit()
        return failures


def _count_email_failure(engine: Engine, email: Email, now: datetime) -> int:
    with Session(engine) as session:
        failures = SqlAccounts(session).count_email_failure(email, now)
        session.commit()
        return failures


def test_clear_email_leaves_an_active_lock_in_place(file_engine: Engine) -> None:
    """A success's `clear_email` must not lift a lock that was set after its own read
    of the guard (plan invariant: `locked_until` is written only by an `UPDATE`
    guarded on `locked_until IS NULL OR locked_until <= :now`) — proven directly at
    this seam, without relying on the race actually happening."""
    email = Email.of("raced@example.com")
    until = NOW + timedelta(minutes=15)
    with Session(file_engine) as session:
        accounts = SqlAccounts(session)
        for _ in range(5):
            accounts.count_email_failure(email, NOW)
        accounts.lock_email(email, NOW, until, max_failures=5)
        # A further refusal under the now-active lock (plan invariant: every refused
        # login counts, lock included) leaves `failures` at 1, not 0 -- so the
        # assertion below actually exercises `clear_email`'s guard instead of
        # trivially holding from `lock_email`'s own subtraction.
        accounts.count_email_failure(email, NOW)
        session.commit()

    with Session(file_engine) as session:
        SqlAccounts(session).clear_email(email, NOW)
        session.commit()

    with Session(file_engine) as session:
        row = session.get(LoginGuardRow, email.value)
        assert row is not None
        assert row.locked_until == until
        # If `clear_email`'s guard failed to hold, it would have zeroed this count;
        # proving it is still 1 is what tells the guard apart from a no-op update.
        assert row.failures == 1


def test_n_concurrent_address_failures_give_a_count_of_n(file_engine: Engine) -> None:
    digest = "address-under-contention"
    cutoff = AddressGuard().window_cutoff(NOW)
    n = 25

    with ThreadPoolExecutor(max_workers=n) as pool:
        results = list(
            pool.map(lambda _: _count_address_failure(file_engine, digest, NOW, cutoff), range(n))
        )

    assert sorted(results) == list(range(1, n + 1))


def test_a_burst_straddling_the_cutoff_counts_only_the_failures_after_it(
    file_engine: Engine,
) -> None:
    digest = "address-straddling-the-window"
    before_cutoff = NOW
    _count_address_failure(
        file_engine, digest, before_cutoff, AddressGuard().window_cutoff(before_cutoff)
    )

    after_window = NOW + timedelta(minutes=16)
    cutoff = AddressGuard().window_cutoff(after_window)
    n = 10
    with ThreadPoolExecutor(max_workers=n) as pool:
        results = list(
            pool.map(
                lambda _: _count_address_failure(file_engine, digest, after_window, cutoff),
                range(n),
            )
        )

    # The failure before the cutoff started an expired window: the first failure
    # after it resets the count to one, so the burst's own counts run 1..n, never
    # 2..n+1.
    assert sorted(results) == list(range(1, n + 1))


def _refuse_once(file_engine: Engine, email: Email) -> None:
    """One request's worth of work on a refused login (`log_in`'s own shape): count,
    then lock if that count just reached the threshold — each in its own session, as
    two concurrent requests would."""
    with Session(file_engine) as session:
        accounts = SqlAccounts(session)
        failures = accounts.count_email_failure(email, NOW)
        if failures >= 5:
            accounts.lock_email(email, NOW, NOW + timedelta(minutes=15), max_failures=5)
        session.commit()


def test_a_burst_of_email_failures_leaves_exactly_one_lock_and_a_count_of_n_minus_five(
    file_engine: Engine,
) -> None:
    """Every thread past the fifth failure tries to lock; the guarded `UPDATE` (the
    plan's invariant) must still let only the first one through, and the threshold it
    subtracts must land on the count exactly once, however many threads raced it."""
    email = Email.of("burst@example.com")
    n = 12

    with ThreadPoolExecutor(max_workers=n) as pool:
        list(pool.map(lambda _: _refuse_once(file_engine, email), range(n)))

    with Session(file_engine) as session:
        locks = SqlAccounts(session).login_locks(email, "irrelevant-address")
    assert locks.email_locked_until == NOW + timedelta(minutes=15)

    with Session(file_engine) as session:
        row = session.get(LoginGuardRow, email.value)
        assert row is not None
        assert row.failures == n - 5
