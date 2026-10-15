"""A negative control for `wall_clock_reads`: a direct read of the wall clock."""

from datetime import UTC, datetime

started = datetime.now(UTC)
