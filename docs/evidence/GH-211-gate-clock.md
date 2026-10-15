# GH-211 evidence: the gate gives the same verdict on any date

Close-out of GH-211 ("Follow-up of #142: open important findings"). It answers every metric
of `docs/product/gate.md`. The rules of the guards and of the shifted run are in ADR-0043 and
its amendments; this file cites them and records only what was found and run. It changes no
code and adds no test.

Heads: the guards and the muestra check below were rerun on the head this document ships
with (branch `agentic/GH-211.close-out`, on top of `3c554f7`). The shifted runs were made on
`3c554f7`'s tree by the `shifted-run` subtask (the system also ran the declared checks on that
head: all seven green).

## 1. Root cause

The three operator commands (`app/accounts/adapters/cli.py`,
`app/business_removal/adapters/cli.py`, `app/spreadsheet_import/adapters/cli.py`) read
`system_clock` inside their own `main`, so a test that drove a `main` over data an app had
produced had to run that app on the real clock too. Commit `e73ecf4` patched four test files
for it (GH-142). Now each `main` takes a keyword-only `clock: Clock = system_clock`
(ADR-0043, decision 1). `git diff 869540b..HEAD --stat -- app` touches only those three files
(14 insertions, 12 deletions). The upkeep ticker and onboarding's `_now` default are unchanged.

## 2. Every test that depended on the real clock, and how it is covered now

None is deleted. Every edited test keeps its product assertions and changes only how it sets
its time.

### Python (found by `git grep` at `869540b`, the task base, for `datetime.now`, `date.today`,
`system_clock`, `time.time`, `utcnow` under `tests/`)

| Test file | Was | Now |
| --- | --- | --- |
| `tests/business_removal/adapters/seed.py` | `invite(engine, datetime.now(UTC))` | one `CLOCK = MovableClock(NOW)` for `create_app(clock=)` and `invite(engine, CLOCK())` |
| `tests/business_removal/adapters/test_cli.py` (the GH-142 finding at line 182) | `invite(engine, datetime.now(UTC))`, `business_day(system_clock())`, `main(...)` on the real clock | the same `CLOCK`, `business_day(CLOCK())`, `main(..., clock=CLOCK)` |
| `tests/business_removal/adapters/test_sql_schema_rows.py` | three `datetime.now(UTC)` ("the app runs on the real clock") | one `clock` fixture shared by the app, the token fixtures and `_seed_join_invitations` |
| `tests/business_removal/adapters/test_cli_failed_write.py`, `tests/pricing_settings/test_removal.py` | `main(...)` on the real clock | `main(..., clock=seed.CLOCK)` |
| `tests/accounts/test_cli.py`, `tests/accounts/test_reset_password_cli.py` | `main(...)` on the real clock | one `CLOCK` for every `main` and `create_app`; two new seam tests assert the printed expiry is exactly the injected instant plus 7 days (invitation) and plus 24 hours (reset link) |
| `tests/accounts/test_cookie_secure.py` | (one of the four e73ecf4 files) | already on a clock it controls; needed no edit |
| `tests/design/test_sample_app.py`, `tests/pinned_catalog/test_ticker.py`, `tests/pricing_settings/test_removal.py`, `tests/test_business_isolation.py`, `tests/test_gated_routes.py`, `tests/test_refusal_codes.py`, `tests/test_serving.py`, `tests/test_static_spa.py` | `create_app(...)` with no `clock=`, so the app fell back to `system_clock` | `clock=MovableClock(NOW)` (or the shared fixture) passed by name; `CREATE_APP_REQUIRED_KEYWORDS` now includes `clock`, so an omission fails the gate |
| `tests/e2e_app.py` | `create_app(...)` on the default clock | `clock=system_clock` by name: **the one ALLOWED entry** (see section 5) |

Tests that already set their own time (`MovableClock(NOW)` through the `client` fixtures in
`tests/conftest.py`: the 7-day invitation, 24-hour reset link, 15-minute login brake, the
Argentina business day and "a future date is refused" suites) were confirmed, not redone.

### Vitest and e2e

| File | Was | Now |
| --- | --- | --- |
| 25 e2e specs and helpers (`analysis`, `archivadas`, `catalog`, `catalogInsecureOrigin`, `customers`, `flow`, `insets`, `leaveWithBack`, `nuevaVentaTelefono`, `panel`, `passwords`, `payments`, `pinnedCatalog`, `sales`, `settings`, `tapBudget`, `theme`, `varietiesAutoSelect`, `ventasLinea`, `ventasPhone`, `ventasTelefono`, `withdrawals`, `fixtures.ts`, `helpers/seed.ts`, `helpers/signup.ts`) | `Date.now()` in business names and emails | `uniqueTag()` (`web/e2e/helpers/unique.ts`, `crypto.randomUUID`) |
| `web/e2e/pressed.spec.ts` | `page.clock.install()` at the real instant, `Date.now()` | `page.clock.install({ time: PAGE_CLOCK_START })` at the literal `2030-01-01T12:00:00Z`, read with `performance.now()` |
| `web/src/api/keys.test.ts` | `vi.useFakeTimers()` bare, `Date.now()` | `useFakeTimers({ now: new Date('2026-01-05T12:00:00Z') })`, `calls.push(calls.length)` |
| `web/src/flash/FlashProvider.test.tsx`, `web/src/shell/keepFocusVisible.test.ts` | bare `useFakeTimers()` | `useFakeTimers({ now: <literal> })` |

Other vitest files that mention `Date` (`format/dates.test.ts`, `screens/PinPublish.test.tsx`,
`screens/ventas/Ventas.test.tsx`, `architecture/forbiddenApis.test.ts`) build dates from
arguments or only name `new Date()` in a comment; the guard passes them unchanged.

### Real-clock tests left by design

- **Python:** `tests/e2e_app.py` only (ALLOWED, with its reason: the e2e backend, the invite
  CLI and the browser share one clock, ADR-0040). `pytest` over `tests/` finds no other read.
- **Web:** none. The web guard has no allowlist.
- **No test needed escalation to the PM**; none was deleted.

## 3. Shifted-date verification (one-off; rules in ADR-0043, amendment shifted-run)

Tool: libfaketime 0.9.10 via `LD_PRELOAD`, installed without root under `/tmp/ft`; kernel
7.0.0-38-generic, glibc 2.43. A dev tool of the machine that ran it, not a dependency, and not a
gate step (`.agentic/stack.yaml`, `.github/workflows/ci.yml` and `affected_fallback` carry no
faketime or shift step). Caveat: a statically linked binary, a raw vDSO read or Chromium may
escape the preload; here Chromium took the shift.

### Canaries (a suite counts only when its canary shows the shifted date)

Real now on the `+8d` runs: 2026-10-15 ~18:40Z.

| Shift | Process | Output |
| --- | --- | --- |
| `+8d` | python `datetime.now(UTC)` | `2026-10-23T18:40:09Z` |
| `+8d` | node `new Date()` | `2026-10-23T18:40:09Z` |
| `+8d` | `scripts/invite-business.sh` | "Valid once, until 2026-10-30 18:46 UTC" (shifted now 2026-10-23 18:46 + 7 d) |
| `+8d` | e2e backend `GET /auth/me` `today` | `2026-10-23` |
| `+8d` | browser `Date.now()` | `2026-10-23T18:48Z`; a second Playwright launch at 19:04Z: `2026-10-23T19:04:12Z`, matching node |
| Midnight (start 02:59Z) | python | `2026-10-16T02:59:00Z` |
| Midnight | node | `2026-10-16T02:59:30Z` |
| Midnight | `scripts/invite-business.sh` | "until 2026-10-23 02:59 UTC" |
| Midnight | e2e `GET /auth/me` `today` | `2026-10-16` |
| Midnight | browser `Date.now()` | `2026-10-16T03:00:00Z` |

### Suites (every process shifted, browser included)

| Suite | `+8d` | Start one minute before Argentina midnight (03:00Z), time running |
| --- | --- | --- |
| pytest `-n auto` | exit 0, 2699 dots | 2699 passed in 119 s, started 02:59:00Z |
| vitest | 143 files, 1743 tests passed | 143 files, 1743 tests passed; started 23:59:30 local, ran 70 s, so it crossed midnight while running |
| e2e | 94 passed (main phase) and 2 passed (timed phase) | 94 passed (3.1 m) and 2 passed (27 s); started 23:58:30 local, ran 215 s |

Logs of these runs: `/tmp/ft/logs/` on the machine that ran them (`pytest-8d.log`,
`pytest-mid.log`, `vitest-8d.log`, `vitest-mid.log`, `e2e-8d-b.log`, `e2e-mid-b.log`).

### The one exclusion, stated plainly

Both shifted e2e runs leave out `web/e2e/varietiesAutoSelect.spec.ts:19` (`--grep-invert`). It
is the whole worklist, and it is not about the date:

| Run of that spec | Result |
| --- | --- |
| unshifted | passes (13 s); the Tech Lead re-ran it: `1 passed (12.3s)` |
| preload at `+0d` (no shift) | fails |
| preload at `+8d` | fails |

It reads no date (`Date`, `today` and `clock` do not appear in it); it only throttles the CPU
(`Emulation.setCPUThrottlingRate`), and the click stalls in a Chromium that has the preload.
Classification, by ADR-0043 point 5: a setup artifact of the shifting tool, not a date failure
and not a product regression. The spec was not edited or deleted, and it still runs and passes
in the normal gate. `FAKETIME_SKIP_CMDS` cannot leave the browser unshifted on this machine
(Chromium exits with SIGTRAP at launch), so the browser could not be run unshifted; covering
that spec under a shift would be a new subtask (launch the browser without the preload), and is
listed in section 7.

### The `e73ecf4^` proof

At `e73ecf4^`, `tests/business_removal` and `tests/accounts/test_cookie_secure.py` fail under
`+8d` with `account.invitation_not_usable` (`seed.py:44`); on this head the same tests pass
under `+8d` (133 passed). Limit, recorded: the old tree also fails unshifted today, because
the calendar has already passed its expiry, so this shows the old tests are date-fragile and
the head is not, not that the shift alone catches them. A cleaner proof would run the old tree
at an earlier date; the run is forward only and could not set one.

## 4. The flagging mechanism, shown catching a deliberately added test

Both guards run in the gate on every run (`tests` and `web-tests`).

**Python.** `tests/architecture/test_no_wall_clock.py` walks every `.py` under `tests/`
(fixtures excluded). Its six tests, rerun on this head: `6 passed`.

```text
$ uv run --no-project pytest tests/architecture/test_no_wall_clock.py
6 passed in 1.77s
```

Its proof fixtures (`tests/architecture/fixtures/wall_clock_direct.py`,
`wall_clock_aliased.py`, `wall_clock_system_clock.py`, `wall_clock_free.py`,
`clockless_create_app.py`) are fed to `wall_clock_reads` and to the `create_app` check: the
three that read the clock must be flagged, the free one must not.

A deliberate probe on this head: a temporary `tests/test_zz_probe.py` with
`from datetime import datetime` and `assert datetime.now().year > 2000`, deleted after the run:

```text
E   Left contains one more item: '.../tests/test_zz_probe.py:5: datetime.datetime.now'
FAILED tests/architecture/test_no_wall_clock.py::test_no_test_reads_the_real_clock_outside_allowed
1 failed, 5 passed in 2.47s
```

**Web.** `web/src/architecture/noWallClock.test.ts` runs `findWallClockReads` over
`src/**/*.test.{ts,tsx}` and `e2e/**/*.ts`; `wallClock.test.ts` runs the same function over the
`.txt` proof inputs under `web/src/architecture/fixtures/` (`wall_clock.txt`,
`bare_fake_timers.txt`, `computed_fake_timers.txt`, `computed_set_system_time.txt`,
`commented.txt`, `allowed_forms.txt`, `pinned_fake_timers.txt`, `pinned_set_system_time.txt`),
which the scan glob cannot match. Rerun on this head: 2 files, 9 tests passed.

A deliberate probe: a temporary `web/src/zzProbe.test.ts` with `expect(Date.now()).toBeGreaterThan(0)`,
deleted after the run:

```text
FAIL  src/architecture/noWallClock.test.ts > finds no real-clock read in any test file
AssertionError: expected [ '../zzProbe.test.ts:4 Date.now' ] to deeply equal []
Tests  1 failed | 2 passed (3)
```

A new test that reads the clock is therefore refused before it can go green, and neither guard
measures elapsed time or waits (ADR-0038, ADR-0041). The guards' known limits are in ADR-0043
(web: a `//` inside a string, an aliased `Date.now`; the Tech Lead's open observations on the
Python guard: `import app.clock` / `from app import clock` access to `system_clock`, and one
flat name map for shadowed imports).

## 5. The one ALLOWED entry

`tests/e2e_app.py`, `ALLOWED` in `tests/architecture/test_no_wall_clock.py`: it passes
`clock=system_clock` by name, because the e2e backend, the invite CLI and the browser share
one wall clock by design (ADR-0040). The list is shrink-only; a test fails if an entry stops
reading the clock. Its verdict does not depend on the date: it only chooses the clock; the specs
take "today" from `GET /auth/me`, never from the browser.

## 6. `muestra.md` (ADR-0035) and `compare.sh`

`docs/product/design-system/muestra.md` states `Capturada: 2026-10-07` (line 15) and its figures
are generated at that fixed date, not at today's. `tests/design/test_muestra_seed.py` checks it
(`MovableClock`, the capture script at the stated date); rerun on this head together with the
Python guard:

```text
$ uv run --no-project pytest tests/architecture/test_no_wall_clock.py tests/design/test_muestra_seed.py
10 passed in 4.78s
```

(4 tests in `test_muestra_seed.py`, 6 in the guard.) `scripts/design/compare.sh` is listed in
`.agentic/stack.yaml` only under `design.compare`, a command the design roles may run instead of
a browser; it is not among the declared checks, `ci.yml` or `scripts/affected.py`, so it is
outside the gate.

## 7. Follow-ups, listed and not fixed

- `tests/results/test_period_figures.py:536-538` asserts `elapsed < 1.0` with `time.monotonic()`,
  against ADR-0038. It has nothing to do with dates, so this task leaves it.
- `web/e2e/varietiesAutoSelect.spec.ts:19` is not covered under a shifted browser (section 3).
  Covering it needs the browser launched without the preload: a new subtask.
- The shifted `e73ecf4^` proof is weak by construction (section 3).
- `app/spreadsheet_import/adapters/cli.py:175` gained the `clock` keyword but no test drives
  `main(..., clock=...)` (open Tech Lead finding, `cli-clock`); the import use case itself is
  tested with `run(..., clock=...)`.
- `tests/design/test_sample_app.py`: the app runs on `MovableClock(NOW)` (2026-10-02), but the
  `sample_app` helper subprocess still issues its links on the real clock. The verdict holds for
  any machine date from `NOW` minus 7 days on, so it is safe going forward (the only direction
  the shifted run takes); it is not strictly free of the real clock.
- A test that asserts the instant a production column default stamped would fail under a shift;
  the shifted runs found none.

## 8. Production code that still reads the real clock, by design

Unchanged and not governed by the gate file: the upkeep ticker, onboarding's `_now` default
(`created_at`), `system_clock` as the default of the three `main` signatures and of
`create_app`'s composition root, and `NuevaVenta.tsx`'s `Date.now()` fallback for a row key. The
web guard scans only test files and the Python guard only `tests/`.

## 9. GH-142's open finding

> `tests/business_removal/adapters/test_cli.py:182` (spec-scope): commit e73ecf4 changes four
> Python test files that no subtask brief asked for ... the root cause it names (an invitation
> clock separate from the app clock ...) has no issue filed.

**Resolved by GH-211.** The root cause is closed in code and written down: the operator
commands take their clock (ADR-0043), the four files from `e73ecf4` now share one
`MovableClock` with the app and the commands, and two guards keep a real-clock test from
returning. The finding's other half, that the cause had no issue filed, is answered by this
task itself (GH-211), which is the follow-up the finding asked for.

## 10. Metrics of `docs/product/gate.md`

| Metric | Answer |
| --- | --- |
| Shifted-date pass (criterion 1) | Passed: pytest, vitest and e2e at `+8d` and across Argentina midnight, all canaries showing the shifted date. e2e leaves out one spec, a classified setup artifact of the shifting tool that passes unshifted (section 3). |
| Real-clock tests accounted for (criteria 2, 5) | Section 2. Every one is covered by a movable clock, a pinned fake instant, `uniqueTag()` or the one ALLOWED entry. None left uncovered, none deleted, none escalated. |
| No behaviour change (criterion 3) | `app/` changed only by the three keyword-only parameters (defaults unchanged); the declared checks pass; every edited test keeps its product assertions (checked by the Tech Lead's reviews of `cli-clock` and `py-wall-clock-guard`). |
| Gate stays fast (criterion 4) | No wait, no sleep, no elapsed-time assertion added. The one existing elapsed-time assertion is listed in section 7. |
| Staying fixed | Section 4: both guards, with a deliberately added real-clock test caught in each. |
