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

## Amendment (web-wall-clock): the web guard

No vitest or e2e test file reads the real clock. `web/src/architecture/wallClock.ts`
exports `findWallClockReads(text)`, and `noWallClock.test.ts` runs it over every
`src/**/*.test.{ts,tsx}` and `e2e/**/*.ts` as raw text. It must find nothing, and there
is no allowlist.

- **What it flags.** `Date.now(`, a bare `new Date()` (no arguments) and `Date(` called
  without `new`. `new Date('2026-01-01')`, `Date.UTC(...)` and `performance.now()` are not
  reads of the real clock and pass; `performance.now()` is monotonic and measures no date,
  so an e2e deadline uses it.
- **The one exemption.** A whole file is exempt only when it pins a literal fake instant:
  `vi.useFakeTimers({ now: <literal> })` or `vi.setSystemTime(<literal>)`, the literal
  being a number, a string or `new Date(<number or string>)`. A bare `useFakeTimers()`, or
  one with only `shouldAdvanceTime`, exempts nothing, because it still starts at the real
  instant.
- **Proof inputs are `.txt` files** under `web/src/architecture/fixtures/`, read with
  `?raw` and run through the same function. The scan glob cannot match them, so the guard
  needs no entry for itself, and its own patterns are regular expressions, so their source
  never matches itself.
- **Comments are blanked first**, newlines kept, the way `findActionLinks` does it
  (ADR-0037 amendment). Known limits: a `//` inside a string hides the rest of that line
  (`commented.txt` shows it stops there), and an aliased `const n = Date.now` is not
  caught. It is a ratchet, not a proof, in the same way ADR-0037 words it.
- **`uniqueTag()`** in `web/e2e/helpers/unique.ts`, built on `crypto.randomUUID`, names the
  business and the email of every e2e identity. Two calls in the same millisecond, or on
  two workers, still differ.
- **Page clocks start at a literal.** Where a spec fakes the browser's clock
  (`pressed.spec.ts`), it installs it at a literal instant and reads the fake time with
  `performance.now()`.
- **No pinned e2e clock.** The e2e backend runs on the real clock by design, so a spec
  takes "today" from `GET /auth/me`, never from the browser.
