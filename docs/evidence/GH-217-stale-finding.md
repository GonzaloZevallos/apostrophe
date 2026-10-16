# GH-217 evidence: the finding is stale, the `tests` check is green on HEAD

Close-out of GH-217 ("Follow-up of #136: open important findings"). It changes no code and no
test: the diff is this file only.

## 1. The finding as reported

> `tests/accounts/test_cookie_secure.py:37` (process-suite-red): The `tests` check is red on the
> head (21 failed, 5 errors). The failures come from an invitation that expires: the test clock
> is fixed (NOW = 2026-10-02 in conftest) but the machine date is 2026-10-13. A diff that touches
> only screens.json cannot cause or fix this, and invariants 1 and 3 forbid this branch from
> touching app/ or the tests.

## 2. Why it is stale

- Commit `b2cd707` ("Stop business-removal and cookie tests from expiring their invitations
  against the real clock", 2026-10-14 03:41 -03:00) is an ancestor of HEAD. The finding's machine
  date is 2026-10-13, the day before that commit.
- It touched exactly the files that read the real clock for an invitation:
  `tests/accounts/test_cookie_secure.py`, `tests/business_removal/adapters/seed.py`,
  `tests/business_removal/adapters/test_cli.py`,
  `tests/business_removal/adapters/test_sql_schema_rows.py` (15 insertions, 4 deletions).
  `test_cookie_secure.py` now issues its invitation with `invite(engine, clock())` over
  `MovableClock(NOW)` and builds the app with `clock=MovableClock(NOW)`.
- GH-211 closed the rest of the hole under ADR-0043 and its amendments: `create_app` must be
  given `clock` by name (`CREATE_APP_REQUIRED_KEYWORDS`), `tests/architecture/test_no_real_clock.py`
  resolves aliases, and `docs/evidence/GH-211-gate-clock.md` records a green shifted run.
- The "21 failed, 5 errors" run is not reproduced on a commit that contains `b2cd707`: both
  runs below are green.

## 3. Commands and results

All runs in the GH-217 worktree, `uv run --no-project pytest -n auto`, the `tests` check.

| Step | Command | Result |
| --- | --- | --- |
| HEAD | `git rev-parse HEAD` | `020892544bb7e140dbfbe8e6ef91c9b9a3cf84dd` |
| Ancestry | `git merge-base --is-ancestor b2cd707 HEAD` | exit 0 (ancestor); `b2cd707` = `b2cd7073a7252f6883e423733b72fca0ba25a430` |
| Wall date | `date -u` | `Fri Oct 16 09:41:29 AM UTC 2026` |
| Collect | `uv run --no-project pytest --collect-only -q` | per-file counts sum to **2838** (quiet mode prints no total line) |
| Real date run | `uv run --no-project pytest -n auto` (09:42:35Z to 09:44:37Z) | `2838 passed, 8 warnings in 116.65s (0:01:56)`: 0 failed, 0 errors, 0 skipped, 0 xfailed, 0 xpassed |
| Shift tool | libfaketime 0.9.10 via `LD_PRELOAD`, wrapper `/tmp/ft/bin/ft '+8d' <cmd>` (the one GH-211 used) | not a dependency, not a gate step; `.agentic/stack.yaml`, `ci.yml` and `affected_fallback` untouched (ADR-0043) |
| Canary, system python | `ft '+8d' python3 -c 'from datetime import datetime, UTC; print(datetime.now(UTC))'` at real 09:44:39Z Oct 16 | `2026-10-24 09:44:39.188419+00:00` (real now + 8 days) |
| Canary, the suite's interpreter | `ft '+8d' uv run --no-project python -c '<same>'` | `2026-10-24 09:44:39.479977+00:00` (real now + 8 days) |
| Shifted run | `ft '+8d' uv run --no-project pytest -n auto` (real 09:44:46Z to 09:47:32Z) | `2838 passed, 8 warnings in 159.74s (0:02:39)`: 0 failed, 0 errors, 0 skipped, 0 xfailed, 0 xpassed |

Both totals (2838) equal the collected count, with 0 failed and 0 errors. The shifted run counts:
its canary, under the same wrapper, shows 2026-10-24, past the 7-day invitation window (ADR-0002)
that the 2026-10-16 invitations of the real-date run would have lived in.

## 4. What was not run

The optional `scripts/invite-business.sh` canary was tried under the shift and refused with
`refused: MissingSetting` (the worktree has no production settings); it gives no evidence either
way and is not needed, since the python canary under the same wrapper shows the shifted date.

## 5. Conclusion

The finding is stale. `tests` is green on HEAD at the real date and at +8 days, with nothing
changed in `app/` or `tests/`. No further action; GH-217 can close.
