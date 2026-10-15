---
status: accepted
date: 2026-10-15
---

# The operator commands take their clock; tests never read the wall clock

GH-142's approved head failed a gate that had been green: commit `e73ecf4` had to edit four
test files (`tests/business_removal/adapters/test_cli.py`, `seed.py`,
`test_sql_schema_rows.py`, `tests/accounts/test_cookie_secure.py`) because invitations
issued on the real clock expired seven days later (ADR-0002). The cause was not in those
tests. The three operator commands read `system_clock` inside their own `main`, so nothing
could replace that clock. A test that drove a `main` over data an app had produced had to
run that app on the real clock too, and a test on the real clock passes today and fails once
the calendar moves past an expiry or a day boundary.

ADR-0001 and ADR-0002 are not amended: their rule, an injected clock, was right, and the
commands did not follow it.

## Decision

1. **Each operator command's `main` takes its clock.** `app.accounts.adapters.cli.main`
   (invite-business, reset-password), `app.business_removal.adapters.cli.main` and
   `app.spreadsheet_import.adapters.cli.main` gain a keyword-only `clock: Clock =
   system_clock`. The default `system_clock` appears only in those three signatures; no
   command body and no use case calls `system_clock()`. The use cases already took `now`.
2. **Operators see no difference.** The entry points (`if __name__ == "__main__"` and
   `scripts/*.sh`) call `main()` unchanged and so get the real clock. The keyword is
   reachable only by Python callers; neither argv nor the environment exposes it.
3. **Tests drive the commands and `create_app` with one `MovableClock`.** A test passes the
   same `MovableClock(NOW)` to `create_app(clock=...)` and to `main(..., clock=clock)`, and
   issues invitations with `invite(engine, clock())`. Nothing patches `datetime`.
4. **Production code that reads the real clock stays.** The upkeep ticker and onboarding's
   `_now` column default are real-clock production code by design and are not changed.

## Consequences

- The command tests no longer depend on the date they run on: the expiry the commands print
  is the injected instant plus seven days or 24 hours, and a test asserts exactly that.
- No elapsed-time check is added and nothing waits (ADR-0038, ADR-0041).
