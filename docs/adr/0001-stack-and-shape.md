---
status: accepted
date: 2026-10-02
---

# FastAPI over SQLite, one hexagon per capability, money and grams as whole numbers

The product replaces a spreadsheet for small sellers, keeps several businesses in one
installation (docs/adr/0004), runs locally for now and is maintained by an agentic
development system that already works on a FastAPI + SQLite + uv
product (gym-saas). The toolchain is chosen so the system's setup and checks carry
over unchanged.

## Decision

- **API**: Python 3.13, FastAPI, SQLAlchemy 2.0 with typed `Mapped` columns, Alembic,
  pydantic at the HTTP edge. **SQLite** in a local file: a handful of businesses, one
  machine, no database server to run. uv for environments, pytest, ruff, mypy strict.
- **Front**: comes later, designed with Claude Design, built with React + Vite +
  TypeScript under `web/` in this same repository.
- **Shape**: one hexagon per capability under `app/<capability>/`:
  - `domain/` imports only the standard library, its own package and `app/shared/`;
  - `application/` holds one module per group of use cases and the ports, and never
    imports a framework, the database layer or an adapter;
  - `adapters/` holds tables, repositories, routers and schemas.
  `tests/architecture/` enforces this on every run; a new capability adds its root to
  `HEXAGON_ROOTS` in the diff that creates it. `app/shared/` is a shared kernel of value
  objects and imports only the standard library.
- **Tables** live in their capability's `adapters/tables.py` and are listed in
  `app/tables.py`; the schema test fails when the migrations and those tables disagree.
- **A use case that writes commits once, at its end**, through the `Transaction` port
  (`app/shared/transaction.py`, which a SQLAlchemy `Session` satisfies). Repositories
  flush and never commit, so a use case that touches several records lands whole.
- **Instants are stored in UTC** through `app.db.UtcDateTime`, which refuses naive
  datetimes.
- **Money is whole pesos** (`int`): prices in this business never carry cents.
- **Grams are whole hundredths** (`app/shared/grams.py`): exact sums, no float drift, and
  enough precision for a kitchen scale.
- **"Today" is the business day in Argentina time** (`app/clock.py`); the clock is
  injected so tests move it.

## Considered and rejected

- **SQLModel**, which gym-saas uses: its stubs fight mypy strict and gym-saas carries casts
  for it. Plain SQLAlchemy 2.0 types cleanly.
- **Postgres**: a server to install and back up for a handful of businesses; worth
  revisiting when the app is published.
- **TypeScript end to end (Next.js)**: one language and Claude Design's output drops in,
  but the agentic system has never run a JavaScript product; the API comes first and is
  where most of the logic lives.
- **Decimal pesos**: no price, cost or expense in the spreadsheet has ever had cents.

## Amendment (GH-201): one clock per app

- **The clock is read only through the injected clock** (`app.state.clock`) or the named
  composition roots: `app/clock.py` itself, `create_app`'s default in `app/main.py` and the three
  operator command lines (accounts, business removal, spreadsheet import). Onboarding's
  `created_at` comes from the injected clock too, with no default of its own. No other module under
  `app/` or `tests/` reads the system date; `tests/architecture/test_no_real_clock.py` (ADR-0043)
  enforces that.
- **A test issues anything with an expiry on the clock its app reads**: the fixture's
  `MovableClock`, or `system_clock` on both sides where an operator command issues. Moving the
  fixed `NOW` is not a fix: it only restarts the countdown to the next 7-day, 24-hour or 30-day window.
- **`tests/architecture/test_clock_injection.py` enforces the second**, with `ast` and per call
  site: every `create_app` call under `tests/` names a `clock` (not `None`, no `**` unpacking, and a
  wrapper only if listed and its `clock` has no default).

## Amendment (GH-195): the credential is issued on the app's clock, found by definition

GH-201 closed the `create_app` side: every app built in a test names its clock. This closes the
issuing side. An invitation or reset link minted at a fixed instant (`NOW`, a `datetime(...)`, an
offset from either) and checked by an app on another clock expires between the two.

- **The rule**: a test never gives an issuer of a time-limited credential an instant that does not
  follow the app's clock. It passes `clock()` from the `MovableClock` the app runs on.
  `tests/architecture/test_credential_clock.py` enforces it with `ast`, per call site. It replaces
  the earlier guard that only knew the callee `invite` and the bare name `NOW`.
- **Issuers are keyed by where they are defined**, `(module, qualified name)`, never by a bare
  name: the test helper `issue` and `SessionSigner.issue` share a name and nothing else. Imports
  are read over the whole module (function-local and `as` aliases included). A bare name resolves
  through them or through a top-level `def`; `x.f(...)` resolves as a module function when `x` is
  an imported module and otherwise only against the method rows, by method name. A call that
  resolves to no row is ignored.
- **A fixed instant** is an upper-case name or attribute (`NOW`, `conftest.NOW`, an alias of one),
  a `datetime(...)`, `date(...)` or `timedelta(...)` call, a literal, an operation made only of
  those, or a plain name bound once in its scope to one of them (`now = NOW`). `clock()`, a
  parameter, a loop target and a name bound twice are not fixed.
- **Three groups, every function in exactly one**, checked by a closed-world test over the public
  functions of `invitations.py` and `reset_password.py` and the `add_*`, `issue_*` and `save_*`
  methods of the `Accounts` protocol:
  - `ISSUERS`: the use cases, the port's `issue_reset_link` and the three test helpers, with the
    position of the instant (the keyword `now` is matched too, and `created_at` for the port);
  - `FORBIDDEN_IN_TESTS`: `Accounts.add_invitation` and `Accounts.save_invitation`. They take a
    whole `Invitation`, whose instant sits inside the object; parsing it would mean following
    constructors and fields. A test issues through `invite_new_business` or `invite_partner` on
    its own clock instead. Domain tests that build an `Invitation` with no app stay legitimate;
  - `NOT_ISSUERS`: each with a reason. The checkers (`look_up_invitation`, `accept_invitation`,
    `look_up_reset_link`, `reset_password`) are here because no test calls them: tests reach them
    through HTTP, on the app's clock. That is a reading of the tree, not something the guard checks.
  Every row must resolve to a `def`, so a rename leaves no stale row.
- **Proved by fixtures that fail, never by elapsed time** (ADR-0038): flagged and unflagged shapes
  live under `tests/architecture/fixtures/` with exact counts. No exemption list, no shifted-date run.
- **Known limits**:
  - a fixed instant that reaches an issuer through the parameter of a helper outside the table is
    not seen (`def mint(engine, when): invite(engine, when)`, called as `mint(engine, NOW)`);
  - a future direct call to a checker with a fixed instant is not flagged by itself; it shows only
    when someone reads the `NOT_ISSUERS` rows;
  - the closed-world test reflects only those two modules and the port; a new module of
    credentials elsewhere is added to its reflection list.

## Amendment (GH-318 part 1): money and grams as whole numbers

ADR-0055 and ADR-0057 narrow two sentences of this ADR. The code changes in the parts that build
them; until then both sentences describe what runs.

> **Money is whole pesos** (`int`): prices in this business never carry cents.

Narrowed by [ADR-0057](0057-money-crosses-the-wire-in-currency-units-as-decimal-and-is-stored-per-business-at-scale-0-or-2-behind-one-adapter-helper.md): money is still an `int` column, now a count of the business's smallest
unit at a per-business scale of 0 or 2. Existing businesses stay at scale 0, which is whole pesos;
new ones start at scale 2.

> **Grams are whole hundredths** (`app/shared/grams.py`): exact sums, no float drift, and

Narrowed by [ADR-0055](0055-a-stored-quantity-is-a-whole-number-of-hundredths-whatever-the-unit-and-decimals-only-validate-and-display.md): every stored quantity of every unit is a whole number of hundredths, and
a unit's decimals only validate input and decide display. The gram becomes one unit among the
seller's own; its stored values are unchanged.
