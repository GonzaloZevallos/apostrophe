---
status: accepted
date: 2026-10-08
---

# The tests check runs in parallel with pytest-xdist, `uv run --no-project pytest -n auto`

This ADR records, after the fact, the decision `d518cd9` made on 2026-10-06 (PR #109): the
`tests` check is `uv run --no-project pytest -n auto` (pytest-xdist), in
`.agentic/stack.yaml`, `.github/workflows/ci.yml` and README. PR #109's verification record
lived only in that PR's description and was incomplete: it reported 4 runs instead of 5,
gave no collect count on master, and carried two disagreeing pairs of concurrent-mypy
timings (92/159 s and 88/152 s). Both pairs are dropped, not reconciled. The record now
lives here and not in README, because dated timings in README would go stale silently while
README says how to run things today. ADR-0039 section 1 relies on this decision ("pytest
already runs with `-n auto`").

## Decision

1. **`-n auto` is the `tests` command.** The suite runs on as many xdist workers as the
   machine has CPUs. The serial figure comes from `d518cd9`'s commit message ("the suite
   took 697 s serial under load, 85-280 s with -n auto"); it is cited, not re-measured, and
   it was taken under load.
2. **The comparison that makes it safe is a count.** The serial `--collect-only` total on
   master must equal, for every run on the change, passed + failed + skipped + xfailed +
   xpassed + errors from the summary line. `pyproject.toml` sets `addopts = "-q"`, so xdist
   prints no `[N items]` line and the totals are compared instead. Any non-zero error count
   is reported even when the totals agree. The numbers are in the Verification section and
   only there.
3. **Timings are documentation, never a gate** (ADR-0038). They come from one machine at
   one moment and are indicative only. The mypy timings are measured cold (`.mypy_cache`
   removed before either command starts, `[tool.mypy]` sets no `cache_dir`) so that the
   concurrent and the alone sets compare like with like.
4. **The suite runs no mypy or ruff.** `grep -rnE 'mypy|ruff|subprocess' tests/` finds only
   two subprocesses: `tests/test_no_secrets.py` (`git ls-files`) and
   `tests/migrations/test_table_registry.py` (a fresh interpreter). Neither touches
   `.mypy_cache`, so running `types` beside `tests` shares no state with it.

## Verification

Every row quotes the command that produced it. All of it ran on the tree that carries this
ADR as its only change, from one session, with no other check running on the machine.

### Machine

| What | Command | Result |
|---|---|---|
| CPUs | `nproc` | 16 |
| CPU model | `grep -m1 'model name' /proc/cpuinfo` | AMD Ryzen 7 5700U with Radeon Graphics |
| Other checkouts running checks | `pgrep -af '(^\|/)(pytest\|mypy\|ruff\|vitest)'` before each set | None: it matched no process before the collect, the consecutive runs and the mypy sets (the Developer session's own command line aside) |

### Collected on master (this task's base)

| Command | N tests collected |
|---|---|
| `uv run --no-project pytest --collect-only` | 2655 |

### Consecutive runs of the `tests` command on the change

| Run | Command | Outcome | passed | failed | skipped | xfailed | xpassed | errors | Total | Wall time (s) |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | `/usr/bin/time -f %e uv run --no-project pytest -n auto` | green | 2655 | 0 | 0 | 0 | 0 | 0 | 2655 | 95.35 |
| 2 | `/usr/bin/time -f %e uv run --no-project pytest -n auto` | green | 2655 | 0 | 0 | 0 | 0 | 0 | 2655 | 94.57 |
| 3 | `/usr/bin/time -f %e uv run --no-project pytest -n auto` | green | 2655 | 0 | 0 | 0 | 0 | 0 | 2655 | 89.31 |
| 4 | `/usr/bin/time -f %e uv run --no-project pytest -n auto` | green | 2655 | 0 | 0 | 0 | 0 | 0 | 2655 | 92.15 |
| 5 | `/usr/bin/time -f %e uv run --no-project pytest -n auto` | green | 2655 | 0 | 0 | 0 | 0 | 0 | 2655 | 97.35 |

Every run is green, every total equals the collected count on master, and every error count is zero. The warnings summary is not a failure and is not counted.

### mypy, cold, started together with pytest

Each run clears the cache before either command starts, never between them. It measures
mypy against the whole pytest run, uv start-up and collection included.

| Run | Command | mypy wall time (s) | pytest wall time (s) |
|---|---|---|---|
| 1 | `rm -rf .mypy_cache; /usr/bin/time -f %e -o /tmp/xdist-adr/pytest.time uv run --no-project pytest -n auto > /dev/null 2>&1 & /usr/bin/time -f %e -o /tmp/xdist-adr/mypy.time uv run --no-project mypy app tests; wait` | 38.32 | 100.16 |
| 2 | `rm -rf .mypy_cache; /usr/bin/time -f %e -o /tmp/xdist-adr/pytest.time uv run --no-project pytest -n auto > /dev/null 2>&1 & /usr/bin/time -f %e -o /tmp/xdist-adr/mypy.time uv run --no-project mypy app tests; wait` | 40.60 | 100.41 |
| 3 | `rm -rf .mypy_cache; /usr/bin/time -f %e -o /tmp/xdist-adr/pytest.time uv run --no-project pytest -n auto > /dev/null 2>&1 & /usr/bin/time -f %e -o /tmp/xdist-adr/mypy.time uv run --no-project mypy app tests; wait` | 37.83 | 100.17 |
| median | the runs above | 38.32 | 100.17 |

Pytest outlasted mypy in every run, so mypy ran against a busy machine for its whole length. The spread of the mypy times, (max - min) / median, is under 20 %. Pytest's own output was discarded in these runs, so only its time is recorded; its green outcomes are the runs above.

### mypy, cold, alone

| Run | Command | mypy wall time (s) |
|---|---|---|
| 1 | `rm -rf .mypy_cache; /usr/bin/time -f %e uv run --no-project mypy app tests` | 30.10 |
| 2 | `rm -rf .mypy_cache; /usr/bin/time -f %e uv run --no-project mypy app tests` | 40.19 |
| 3 | `rm -rf .mypy_cache; /usr/bin/time -f %e uv run --no-project mypy app tests` | 33.93 |
| median | the runs above | 33.93 |

The spread of this set, (max - min) / median, is above 20 %: runs on an otherwise idle machine did not agree closely, so the median is the figure to read and even it is indicative only. Its slowest run is as slow as the concurrent runs and the concurrent median is above this one, so the table is inconclusive on whether running pytest beside mypy slows mypy down.
