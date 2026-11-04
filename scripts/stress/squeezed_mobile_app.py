"""The phone check's server on a squeezed connection pool, for reproducing GH-542's
`QueuePool limit ... reached` (docs/evidence/GH-542-ci-ok-flake.md). Task evidence, not
product tooling: nothing under `app/` imports it, and `tests.e2e_app` keeps the pool it
has. Run it like the e2e server:

    uvicorn scripts.stress.squeezed_mobile_app:create_squeezed_mobile_app --factory

The pool is read from `STRESS_POOL_SIZE`, `STRESS_MAX_OVERFLOW` and `STRESS_POOL_TIMEOUT`
(defaults: SQLAlchemy's own 5, 10 and 30). `STRESS_DIAGNOSTICS=1` adds two kinds of line on
stderr: a short stack at every pool checkout, so a stuck connection names its holder, and
the most threads seen waiting on a business's pinned-catalog lock. Nothing but counts, call
sites and ids of the pool prints: no row, amount, token or business data.
"""

from __future__ import annotations

import os
import sys
import threading
import traceback
from collections.abc import Mapping
from types import TracebackType
from typing import Any, cast

from fastapi import FastAPI
from sqlalchemy import create_engine, event
from sqlalchemy.engine import Engine, make_url
from sqlalchemy.engine.interfaces import DBAPIConnection
from sqlalchemy.pool import ConnectionPoolEntry, QueuePool

from app.pinned_catalog.application.push import BusinessLocks
from tests.e2e_app import create_mobile_e2e_app

POOL_SIZE = "STRESS_POOL_SIZE"
MAX_OVERFLOW = "STRESS_MAX_OVERFLOW"
POOL_TIMEOUT = "STRESS_POOL_TIMEOUT"
DIAGNOSTICS = "STRESS_DIAGNOSTICS"

_STACK_FRAMES = 12
_OUR_CODE = ("/app/", "/scripts/", "/tests/")


def _say(line: str) -> None:
    sys.stderr.write(f"stress: {line}\n")
    sys.stderr.flush()


def _holder_stack() -> str:
    """The frames of this checkout that are the product's own, outermost first."""
    frames = traceback.extract_stack()[:-2]
    ours = [frame for frame in frames if any(part in frame.filename for part in _OUR_CODE)]
    return " > ".join(f"{frame.name}:{frame.lineno}" for frame in ours[-_STACK_FRAMES:])


def _watch_pool(engine: Engine) -> None:
    pool = engine.pool

    def checkout(_dbapi: DBAPIConnection, _record: ConnectionPoolEntry, _proxy: object) -> None:
        out = cast(QueuePool, pool).checkedout()
        _say(
            f"checkout checkedout={out} thread={threading.current_thread().name} {_holder_stack()}"
        )

    def checkin(_dbapi: DBAPIConnection | None, _record: ConnectionPoolEntry) -> None:
        _say(f"checkin checkedout={cast(QueuePool, pool).checkedout()}")

    event.listen(pool, "checkout", checkout)
    event.listen(pool, "checkin", checkin)


class _CountedLock:
    def __init__(self, inner: Any, counter: _Waiters) -> None:
        self._inner = inner
        self._counter = counter

    def __enter__(self) -> bool:
        self._counter.arrive()
        try:
            return cast(bool, self._inner.__enter__())
        finally:
            self._counter.leave()

    def __exit__(
        self,
        exc_type: type[BaseException] | None,
        exc: BaseException | None,
        tb: TracebackType | None,
    ) -> None:
        self._inner.__exit__(exc_type, exc, tb)


class _Waiters:
    def __init__(self) -> None:
        self._guard = threading.Lock()
        self._now = 0
        self.peak = 0

    def arrive(self) -> None:
        with self._guard:
            self._now += 1
            if self._now > self.peak:
                self.peak = self._now
                _say(f"lock-waiters peak={self.peak}")

    def leave(self) -> None:
        with self._guard:
            self._now -= 1


class CountingLocks:
    """`BusinessLocks` with the number of threads waiting on a business's lock counted.
    Wrapped here, never in `app/`; `app.state.pinned_catalog_locks` is untyped, so this
    stands in for it by shape (`for_business`)."""

    def __init__(self, inner: BusinessLocks) -> None:
        self._inner = inner
        self.waiters = _Waiters()

    def for_business(self, business_id: int) -> _CountedLock:
        return _CountedLock(self._inner.for_business(business_id), self.waiters)


def _enable_foreign_keys(dbapi_connection: DBAPIConnection, _record: ConnectionPoolEntry) -> None:
    # The same PRAGMA `app.db.make_engine` sets on every SQLite connection.
    dbapi_connection.execute("PRAGMA foreign_keys=ON")


def squeezed_engine(url: str, environ: Mapping[str, str]) -> Engine:
    """What `app.db.make_engine` builds for a file SQLite (`check_same_thread=False`,
    `hide_parameters=True`, the foreign-key PRAGMA), with a `QueuePool` sized from the
    environment. An in-memory URL is refused: it has no pool to squeeze."""
    if make_url(url).database in (None, "", ":memory:"):
        raise ValueError("the squeezed pool needs a file database")
    engine = create_engine(
        url,
        hide_parameters=True,
        connect_args={"check_same_thread": False},
        poolclass=QueuePool,
        pool_size=int(environ.get(POOL_SIZE, "5")),
        max_overflow=int(environ.get(MAX_OVERFLOW, "10")),
        pool_timeout=float(environ.get(POOL_TIMEOUT, "30")),
    )
    event.listen(engine, "connect", _enable_foreign_keys)
    return engine


def create_squeezed_mobile_app() -> FastAPI:
    """`tests.e2e_app.create_mobile_e2e_app()` over the squeezed engine. The swap is sound
    because nothing keeps the engine `create_app` made: every reader takes
    `app.state.engine` when it runs (the lifespan, `get_session`, `run_upkeep_safely`, the
    pinned-catalog router) and the ticker is off in this app."""
    app = create_mobile_e2e_app()
    original = cast(Engine, app.state.engine)
    engine = squeezed_engine(original.url.render_as_string(hide_password=False), os.environ)
    original.dispose()
    if os.environ.get(DIAGNOSTICS):
        _watch_pool(engine)
        app.state.pinned_catalog_locks = CountingLocks(app.state.pinned_catalog_locks)
    app.state.engine = engine
    return app
