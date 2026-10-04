"""The one place in `app/business_removal/` that calls `signal.pthread_sigmask`
(the plan's invariant): `blocked_signals()` blocks SIGINT, SIGHUP and SIGTERM for
the body of a `with` block, so a signal cannot land between a write and the flag
that says it happened, then restores the previous mask -- with `SIG_SETMASK`, never
`SIG_UNBLOCK`, so a signal blocked by a caller before this one started stays
blocked once this one is done, rather than being unblocked out from under it.

Stdlib only (CODING_STANDARDS section 1): this is `application/`, not an adapter.
"""

from __future__ import annotations

import signal
from collections.abc import Iterator
from contextlib import contextmanager

BLOCKED_SIGNALS = (signal.SIGINT, signal.SIGHUP, signal.SIGTERM)


@contextmanager
def blocked_signals() -> Iterator[None]:
    previous = signal.pthread_sigmask(signal.SIG_BLOCK, BLOCKED_SIGNALS)
    try:
        yield
    finally:
        signal.pthread_sigmask(signal.SIG_SETMASK, previous)
