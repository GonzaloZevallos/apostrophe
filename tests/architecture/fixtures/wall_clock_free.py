"""A positive control for `wall_clock_reads`: measuring elapsed time and sleeping read no
date, so none of this is flagged."""

import time
from time import monotonic, perf_counter, sleep

started = time.monotonic()
sleep(0)
elapsed = perf_counter() - monotonic() + (time.monotonic() - started)
