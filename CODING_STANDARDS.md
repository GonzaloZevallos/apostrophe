# Coding standards

How code is written in this product. They apply to the code a task adds or touches. They
replace the agentic system's default standards whole (agentic-system, ADR-0012): sections
1 to 8 are those practices said for this stack; section 9 is this product's own and
outranks every other; section 10 says the frontend's.

## 1. Hexagonal architecture

- One hexagon per capability under `app/<capability>/` with `domain/`, `application/`
  and `adapters/` (docs/adr/0001).
- `domain/` imports the standard library, its own package and `app/shared/` only.
- `application/` holds the use cases and the ports (`typing.Protocol`). It never imports
  FastAPI, SQLAlchemy, Alembic, pydantic, `app.db`, `app.tables` or any adapter.
- `adapters/` holds tables, repositories, routers, schemas and command lines.
- `tests/architecture/` checks these rules on every run. A new capability adds its root
  to `HEXAGON_ROOTS` in the diff that creates it.

## 2. Tactical DDD

- `CONTEXT.md` is the language. Names in code and tests use its English terms exactly;
  the screen uses its `_In the app_` word. A new concept goes into the glossary first.
- Entities, value objects (frozen dataclasses validated in `__post_init__`), aggregates
  with one root, repositories as ports.
- Invariants live in the domain, never only in a pydantic schema or a database constraint.

## 3. SOLID

- A module changes for one reason. The domain declares ports; adapters implement them.

## 4. Patterns name problems

- A pattern goes in when it names a problem the code has, said in the plan. No CQRS,
  event sourcing or message bus until a task needs one.

## 5. Tests at the seams

- Domain unit tests with no infrastructure.
- Behaviour tests through the HTTP API with `TestClient`, over a fresh in-memory SQLite
  per test, the real adapters and the movable clock in `tests/conftest.py`. Sign in with
  the fixtures (`client`, `other_client`), never by building rows by hand.
- Test-first at seams agreed in the plan. A test that breaks on a refactor without a
  change of behaviour is wrong.

## 6. Strict typing, without silencing

- `mypy --strict` over `app` and `tests`, and `ruff`, pass with nothing silenced: no
  `type: ignore`, no `noqa`, no per-module `ignore_errors`.
- The front (`web/`): `tsc` in strict mode and `oxlint` pass the same way: no
  `@ts-ignore`, `@ts-expect-error`, `@ts-nocheck` or lint-disable comments, no `any`.

## 7. Observability

- Nothing is emitted yet, on purpose. A capability that starts emitting says what and
  where in its plan, under section 9's rules for personal data.

## 8. Security and performance

- A change that widens what an input reaches says in its plan what it now allows and
  to whom. A change whose cost grows with data says so, with the shape of the cost.

## 9. Business isolation and privacy

Several businesses share one installation and must never see each other
(docs/adr/0004). This section outranks every other.

- **The business comes from the session, never from the request.** Every gated endpoint
  takes `CurrentBusinessId` (`app/accounts/adapters/deps.py`). No path, query parameter
  or body field names a business.
- **A repository is built for one business** and filters every statement on it. A record
  of another business is, from there, a record that does not exist: **404, never 403**,
  so its existence is not revealed.
- **Every table carries `business_id`**, not null, pointing at `business`, child tables
  included. Only the platform tables (`business`, `invitation`, `login_guard`,
  `login_address_guard`) are exempt; `login_address_guard` (docs/adr/0017) brakes a
  client address before any business is known, the same reason `login_guard` is
  exempt. `tests/migrations/test_business_ownership.py` enforces it.
- **Every new route joins the isolation sweep** in `tests/test_business_isolation.py`:
  its records in a seeder, its body in `BODIES`. The sweep fails until it does.
- **Every new router is gated**: `app.main` includes it with `require_session`;
  `tests/test_gated_routes.py` fails for any route that answers without a session.
- **No personal data or money in logs or error messages**: no phone numbers, customer
  names, amounts, tokens or passwords. Error details name the rule broken, not the data.
- **Secrets are stored encrypted** (a Telegram bot token, for one), keyed from
  `APOSTROPHE_SECRET_KEY`, and never returned by any route once stored.
- **Passwords only as scrypt hashes** (`app/accounts/domain/password.py`); tokens and
  invitation links only as digests where they are stored.
- A use case that writes **commits once, at its end**, through the `Transaction` port
  (`app/shared/transaction.py`); repositories never commit.

## 10. The frontend

React, Vite and TypeScript in `web/`, built from the design in `docs/product/design-system/`
(the contract) and its screens in `docs/product/design-system/pantallas/`.

- **Names in code are English**, the `CONTEXT.md` terms, as in the backend. **Every word
  on screen is Spanish**, rioplatense with vos ("Cargá", "Te debe"), using the glossary's
  `_In the app_` word.
- **The backend decides; the front shows.** A line's price, a sale's total, a balance and
  where a payment goes come from the API. The front may preview a computation before
  saving (the design's `precios.ts`), but what it shows after saving is what the API
  answered.
- **Color, type and spacing only from the design tokens.** No loose hex values in a
  component. The design README's accessibility rules are requirements: blue ↔ amber,
  never green ↔ red; no state told by color alone; text at 4.5:1 at least.
- **Formats in one place**: money as whole pesos with dot thousands (`$ 11.000`), grams
  with a comma and up to two decimals (`3,5 g`), dates `dd/mm`, weeks Monday to Sunday.
- **Section 9 holds in the browser too.** The business is never in a URL. No phone
  numbers, names, amounts or tokens in `console`, in `localStorage` or in error reports;
  the session lives in the backend's cookie, never in browser storage.
- **Tests at the seams**: screens and components with Testing Library, through what the
  user sees and does, with the API faked at `fetch`. Formats and previews with plain
  unit tests.
- **A screen looks like its design**, by eye: the same structure, hierarchy, type, colors,
  spacing and components as its file in `pantallas/`. Look at its comparison
  (`scripts/design/comparisons.mjs`, design README) before delivering, and keep its entry
  in `scripts/design/screens.json` true.
