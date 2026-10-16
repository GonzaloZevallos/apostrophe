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

## Amendment (py-wall-clock-guard): the pytest guard

1. **No Python file under `tests/` or `app/` reads the wall clock.**
   `tests/architecture/test_no_real_clock.py` walks the AST of every `.py` under both trees and
   resolves each name through the module's import table, aliases included, so a name counts
   for what it is bound to. Its pure helper `real_clock_reads(source)` names each read, with
   the function that holds it; it flags calls and bare references alike
   (`default_factory=datetime.now`) to `datetime.now`, `utcnow`, `today`, `date.today`,
   `time.time`, `time.time_ns` and `app.clock.system_clock`.
2. **Elapsed time is not this guard's business.** `time.monotonic`, `time.perf_counter` and
   `sleep` are not flagged: they measure no date. ADR-0038 governs elapsed-time checks.
3. **The allowlists are closed.** A wall-clock read is allowed by path and enclosing function:
   `app/clock.py::system_clock`. Naming `system_clock` is allowed by exact path, no glob: the
   composition roots `app/main.py` and the three command lines, and `tests/e2e_app.py`, which
   shares the real clock with the CLI subprocess and the browser by design (ADR-0040). Each
   entry has a one-line reason, a test fails when an entry no longer matches a read, and
   another entry is added only with a decision of its own. A test that reads the clock is
   fixed with a controlled clock. Out of reach, by design: patching by string, and an alias
   imported from another test module (it is caught where it is defined).
4. **Every test app names its clock.** `CREATE_APP_REQUIRED_KEYWORDS` in
   `tests/architecture/test_architecture.py` is now `telegram`, `upkeep_ticker` and `clock`,
   so a `create_app(...)` call under `tests/` that omits `clock=` fails the gate instead of
   falling back to `system_clock`. A test passes a `MovableClock`; `tests/e2e_app.py` passes
   `system_clock` by name.

## Amendment (web-wall-clock): the web guard

No vitest or e2e test file reads the real clock. `web/src/architecture/wallClock.ts`
exports `findWallClockReads(text)`, and `noWallClock.test.ts` runs it over every
`src/**/*.test.{ts,tsx}` and `e2e/**/*.ts` as raw text. It must find nothing, and there
is no allowlist.

- **What it flags.** `Date.now(`, a bare `new Date()` (no arguments) and `Date(` called
  without `new`. `new Date('2026-01-01')`, `Date.UTC(...)` and `performance.now()` are not
  reads of the real clock and pass; `performance.now()` is monotonic and measures no date,
  so a deadline built in an e2e helper would use it.
- **The one exemption.** A whole file is exempt only when it pins a literal fake instant:
  `vi.useFakeTimers({ now: <literal> })` or `vi.setSystemTime(<literal>)`, the literal
  being a number, a string or `new Date(<number or string>)`. A bare `useFakeTimers()`, or
  one with only `shouldAdvanceTime`, exempts nothing, because it still starts at the real
  instant.
- **Proof inputs are `.txt` files** under `web/src/architecture/fixtures/`, read with
  `?raw` and run through the same function. The scan glob cannot match them. The guard's own test files hold no
  proof input and pin no fake instant (`noWallClock.test.ts` asserts it), and its own
  patterns are regular expressions, so their source never matches itself. The guard needs
  no entry for itself.
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

## Amendment (shifted-run): the one-off shifted-date verification

1. **Forward only.** The gate's suites are run once under `faketime` at `+8d` and from a
   start one minute before Argentina midnight (03:00 UTC), with time running, so pytest
   (`-n auto`) and vitest each cross the midnight while running. The clock never moves
   backward.
2. **A one-off, never a gate step.** The result is recorded in GH-211's evidence. The shifted
   run is never added to `.agentic/stack.yaml`, `.github/workflows/ci.yml` or
   `affected_fallback`. `faketime` is a dev tool on the machine that runs it, not a product
   dependency.
3. **Canaries decide whether a result counts.** Each kind of process is checked under the
   exact wrapper its suite uses: `python` (`datetime.now(UTC)`), `node` (`new Date()`),
   `scripts/invite-business.sh` ("Valid once, until …" equals shifted now + 7 days), the
   e2e backend's `GET /auth/me` `today`, and `Date.now()` in the browser. A suite whose
   canary shows the real date is void, never reported as a pass.
4. **An unshifted browser covers less.** If the browser has to stay unshifted, that run
   covers only "today comes from `me.today`", not cookies or session expiry, which
   `tests/accounts` cover under the pytest shift.
   On the machine that ran it, `FAKETIME_SKIP_CMDS` made the Playwright Chromium crash at
   launch, so the browser ran shifted, and its canary shows the shifted date.
5. **A failure that also appears at `+0d` is not about the date.** A spec that fails with the
   preload in place and no shift is recorded as a setup artifact of the shifting tool, not
   fixed in the spec, and not counted against the date result.

Evidence: `docs/evidence/GH-211-gate-clock.md` (GH-211's close-out document).
