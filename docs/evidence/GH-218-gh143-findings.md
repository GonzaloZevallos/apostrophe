# GH-218 evidence: the open findings of GH-143 are already resolved on master

Close-out of GH-218 ("Follow-up of #143: open important findings"). It changes no code and
adds no test: it runs the full gate on master's head and records which commit resolved each
of the eight findings. No ADR is written or amended.

## 1. Head and date

| | |
| --- | --- |
| Head | `9c54c828fe27dc94977bd2e8de3b3238132186aa` (Merge pull request #248, GH-244), the task base |
| Run date | 2026-10-16 (the machine's date, `date +%F`) |
| Branch | `agentic/GH-218`, working tree clean before this file |

## 2. The full gate, in full form

Each command is the one in `.agentic/stack.yaml` `checks:`, not the affected-only form, run
in the foreground from the checkout root.

| Check | Command | Exit | Summary line |
| --- | --- | --- | --- |
| `lint` | `uv run --no-project ruff check .` | 0 | `All checks passed!` |
| `types` | `uv run --no-project mypy app tests` | 0 | `Success: no issues found in 546 source files` |
| `web-types` | `npm --prefix web run typecheck` | 0 | `tsc -b`, no output |
| `web-lint` | `npm --prefix web run lint` | 0 | `oxlint --deny-warnings`, no output |
| `tests` | `uv run --no-project pytest -n auto` | 0 | `2838 passed, 8 warnings in 191.93s`: 0 failed, 0 skipped, 0 errors |
| `web-tests` | `npm --prefix web test` | 0 | `Test Files 160 passed (160)`, `Tests 2051 passed (2051)` |
| `web-e2e` | `npm --prefix web run e2e` | 0 | main phase `100 passed (3.5m)`; timed phase `2 passed (19.2s)` |

The 8 pytest warnings are SQLAlchemy/sqlite `DeprecationWarning`s on the default datetime
adapter; none is a failure.

The 21 failures and 5 errors GH-143's head showed do not reproduce: on this head the backend
suite has none.

## 3. The named guards, green by name

| Guard | Command | Result |
| --- | --- | --- |
| `tests/architecture/test_no_real_clock.py` | `pytest tests/architecture/test_no_real_clock.py -p no:xdist -q` | 62 passed |
| `tests/architecture/test_architecture.py` (the `create_app` `clock=` rule, `CREATE_APP_REQUIRED_KEYWORDS = frozenset({"telegram", "upkeep_ticker", "clock"})`, line 128) | same, on that file | 35 passed |
| `tests/accounts/test_cookie_secure.py` | same, on that file | 2 passed |
| `web/src/architecture/noWallClock.test.ts` | `npx vitest run <file> --reporter=verbose` (in `web/`) | 3 passed |
| `web/src/architecture/closingGuards.real.test.ts` | same | 7 passed |

The three Python files together: `99 passed`. The two web files together: `Test Files 2
passed (2)`, `Tests 10 passed (10)`.

The `create_app` rule has its own proof of rejection in `test_architecture.py`:
`test_the_create_app_guard_flags_a_call_naming_neither_keyword` and
`test_the_create_app_guard_flags_a_call_that_names_everything_but_the_clock` feed it calls that
must be flagged.

## 4. Each finding and the commit that resolved it

The eight findings of the request, by file:line and kind:

| # | File:line | Kind | Resolved by | Why it is resolved |
| --- | --- | --- | --- | --- |
| 1 | `web/src/architecture/closingGuards.real.test.ts:26` | standard-seams | GH-164: `e18269c`, `a765861`, merged in `50fb96a` | `OLD_SHAPES` is `{}`: the shrink {4,3} to {2,0} was the forced step, and the allowlist is now empty |
| 2 | `tests/accounts/test_cookie_secure.py:37` | process-suite-red | GH-211 (ADR-0043 and its amendments, merged `308ec6a`) and `b2cd707` | the app and the invitation share one `MovableClock(NOW)` |
| 3 | `tests/accounts/test_cookie_secure.py:37` | process-suite-red | same | same |
| 4 | `tests/accounts/test_cookie_secure.py:37` | process-suite-red | same | same |
| 5 | `tests/accounts/test_cookie_secure.py:37` | process-suite-red | same | same |
| 6 | `web/src/architecture/closingGuards.real.test.ts:28` | standard-seams | GH-164: `a765861`, `e18269c`, merged `50fb96a` | the StockStep entry ({3,4} to {2,2}) is gone: `OLD_SHAPES = {}` |
| 7 | `tests/accounts/test_cookie_secure.py:37` | process-suite-red | GH-211 and `b2cd707` | as rows 2 to 5 |
| 8 | `web/src/architecture/closingGuards.real.test.ts:25` | standard-seams | GH-164, as rows 1 and 6 | OnboardingStep {2,0} and StockStep {2,2} are both gone |

Rows 2 to 5 and 7 are the five process-suite-red findings; rows 1, 6 and 8 are the three
standard-seams findings. Commits:

- `b2cd707` Stop business-removal and cookie tests from expiring their invitations against the real clock
- `a765861` Draw the Onboarding step bodies, the Inicio notice and Precios through Boton/StepSubmit so OLD_SHAPES ends empty
- `e18269c` Draw the Onboarding frame and Listo through Boton, with a saltar glyph, so Cerrar is icon-only and the old shapes shrink
- `50fb96a` Merge master (869540b) into GH-164
- `308ec6a` Merge pull request #233 (GH-211)

The current lines that prove them, on this head:

`tests/accounts/test_cookie_secure.py`, the issuer and the verifier on one instant:

```python
33  def _open_business(settings: Settings, engine: Engine, client: TestClient) -> None:
34      clock = MovableClock(NOW)
35      token = invite(engine, clock())
...
42      app = create_app(
43          settings,
44          engine=engine,
45          clock=MovableClock(NOW),
```

(and the same `clock=MovableClock(NOW)` at line 69, in `_logout_set_cookie`). Both
`MovableClock(NOW)` are the same instant, so the invitation is never past its 7-day lifetime
whatever the machine's date is.

`web/src/architecture/closingGuards.real.test.ts:29`:

```ts
const OLD_SHAPES: Record<string, { buttons: number; classes: number }> = {}
```

The header (line 5) says it stays empty. The guard at line 62 still asserts exact equality at
line 69, `expect(found).toEqual(OLD_SHAPES)`, so a new raw `<button>` or `boton*` class outside
`Boton` and `BotonLink` fails it.

## 5. What carries "the same verdict on any date"

This run does not. A green run on 2026-10-16 is 14 days past `NOW` (2026-10-02) and past the
7-day invitation lifetime, so it shows only that the defect behind GH-143's red head is gone
today. A run on one day proves only that day. Two things carry the claim:

- the static guard `tests/architecture/test_no_real_clock.py`, with its closed allowlist, and
  the required `clock=` keyword on `create_app` in tests (`CREATE_APP_REQUIRED_KEYWORDS`);
  its web twin is `web/src/architecture/noWallClock.test.ts`;
- the one-off `+8d` and Argentina-midnight shifted run recorded in
  `docs/evidence/GH-211-gate-clock.md`, section 3 (pytest 2699 passed, vitest 1743, e2e 94 and
  2, every canary showing the shifted date).

Two decisions here, with their reasons:

- No `NOW - 1d` run: ADR-0043 forbids moving the clock backward.
- No fresh shifted run: that run is a one-off by design, and this task changes nothing a
  shifted run could catch.

Known limit: master has merged work since that shifted run (for example #244 and #248). If it
added a real-clock path the static guard cannot see (patching by string, or an alias imported
from another test module, the guard's documented limits in ADR-0043), the `+8d` evidence does
not cover it and neither does this run. On this head, the guards are green and no test failed.

## 6. The diff outside `docs/evidence/`

```text
$ git diff --stat 9c54c82 -- app web/src tests web/e2e
$
```

Empty (zero lines of output): nothing under `app/`, `web/src/`, `tests/` or `web/e2e/` changed.
No test needed a same-clock fix, no `NOW` was changed and no allowlist entry was added. The
only file this task adds is this one.
