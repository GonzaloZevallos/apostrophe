# Coding standards

How code is written in this product. They apply to the code a task adds or touches. They
replace the agentic system's default standards whole (agentic-system, ADR-0012): sections
1 to 8 are those practices said for this stack; section 9 is this product's own and
outranks every other; section 10 says the frontend's; section 11 names the database.

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

- `mypy --strict` over `app`, `tests` and `scripts`, and `ruff`, pass with nothing silenced: no
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
  on screen is English**, plain second person ("Save", "Owes you"), using the glossary's
  `_In the app_` word. Every text lives in `web/src/copy/`, keyed, never in a screen.
- **The backend decides; the front shows.** A line's price, a sale's total, a balance and
  where a payment goes come from the API. The front may preview a computation before
  saving (the design's `precios.ts`), but what it shows after saving is what the API
  answered.
- **Color, type and spacing only from the design tokens.** No loose hex values in a
  component. The design README's accessibility rules are requirements: no state told by color alone: a sign, arrow or word on every gain, loss, debt or state; chart series labelled directly; text at
  4.5:1 at least.
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

### Phone

What "feels like an app" means below the 900 px computer breakpoint (the computer layouts
are out of its scope). The app ships to phones as this same web app, so whatever the web
does on a phone is the final app. The same eight requirements, with the same labels, are in
the design README's "En el celular"; the two texts are one rule.

Each part is **checked** (`web/e2e/mobile.spec.ts` fails on it, under the named `Rule` of
`web/src/mobile-standard/violation.ts`) or **review** (a reviewer enforces it). Where
`docs/product/accounts.md` (the installed shell), ADR-0027, ADR-0028, ADR-0029 or ADR-0048
already decides a point, this section cites it and does not restate it. An area's product
doc may record a deliberate exception; without one, this standard wins over an area issue.

1. **Chrome.**
   - Checked: the bottom bar, the header and "+ Nueva venta" are inside the viewport at load
     and after scrolling to the middle (`chrome-at-load`, `chrome-mid-scroll`).
   - Review: the bar and header are fixed; content is padded so nothing sits behind them.
     Insets and `dvh` are the installed shell's (accounts.md): the `--inset-*` tokens, and
     never `100vh`.
2. **Touch.**
   - Checked: every visible button, link and input is at least 44x44 CSS px, the native
     date control included, and a text action gets padding, not just its line height
     (`touch-target`); the only exemption is a link inside running text. `user-select: none`
     and `touch-action: manipulation` on buttons, tabs and the bar (`user-select`,
     `touch-action`).
   - Review: 8 px between neighbours; nothing depends on hover; every button and row has an
     `:active` state and no default tap highlight (both the installed shell's, accounts.md).
3. **Inputs.**
   - Checked: font-size of at least 16 px on every input, select and date (`input-font`);
     an `autocomplete` value on every visible input: `username` on the login email,
     `organization` on the business name, `current-password`, `new-password`, and `off` on a
     customer's name and phone (`autocomplete`); `inputmode="decimal"` on grams and
     `inputmode="numeric"` on pesos (`inputmode`); `type="email"` and `type="tel"`
     (`input-type`).
   - Review: `enterkeyhint`, except on Nueva venta's lines, which sales.md's tests check.
     The keyboard is by outcome only: the focused field stays in view and the submit is
     reachable by scrolling. The viewport meta is the installed shell's; nobody changes it
     outside #77 (ADR-0028).
4. **Forms and sheets** (review as a whole; their controls fall under the checked rules of
   touch, inputs and readability).
   - A sheet that holds fields or a list is full screen on the phone, with "Cerrar" on top;
     its primary action is fixed at the bottom within thumb reach while the keyboard is
     closed (pinning it above the keyboard is each screen's decision, as Nueva venta did,
     ADR-0028).
   - A sheet is a history entry: system back and Escape close it, and the background scroll
     is locked (ADR-0027).
   - A confirmation ("Antes de borrar", "¿Descartás la venta?") is a short dialog with two
     buttons of at least 44 px, not a sheet. Escape and system back dismiss it as its "No"
     does.
   - A getting-in screen (Entrar, NegocioNuevo, Invitacion, Reset) is a screen, not a sheet:
     it keeps its centred column, and every other rule applies to it in full.
5. **Layout.**
   - Checked: no horizontal page scroll at 320 px or at 130 % (246 CSS px) (`h-scroll`); a
     long name truncates with an ellipsis (`name-overflow`); a figure never splits across
     lines and "$" never stays alone on a line (`figure-split`), shown with the check's
     fixture of a 60-character name and nine-digit figures.
   - Review: lists, not tables, on the phone.
6. **Gestures.**
   - Checked: `overscroll-behavior: none` on `html` and `body` (`overscroll`).
   - Review: system back follows history (ADR-0027); scrolling regions use `contain`
     (accounts.md).
7. **Loading** (checked), with the API held:
   - the content area is shaped like its final layout and carries `aria-busy="true"`
     (`blank-while-loading`, `aria-busy`);
   - no fixed empty-state wording shows until the response arrives (`false-empty`), and the
     loading state holds no digit or currency symbol (`data-while-loading`);
   - when the data arrives the chrome moves 0 px (`chrome-shift`) and the content area at
     most `CONTENT_SHIFT_PX` (`content-shift`);
   - a tap on Nueva venta's save, Registrar cobro's save and Entrar's "Entrá" shows its
     pending state at once (`pending-state`).

   Review: a new fixed empty or no-activity wording goes into
   `web/src/copy/emptyStates.ts`; screens render from it, and the check forbids every
   wording in it while data loads. A literal copy in a screen fails its guard.
8. **Readability** (checked).
   - Every text node is at least 4.5:1 against its effective background, in both themes,
     with no large-text relaxation (`contrast`); a background the arithmetic cannot prove is
     reported, never passed (`contrast-unprovable`). No text is under 12 px, with no
     exemption (`text-size`).
   - A disabled control's own label is exempt; a reason shown in words beside it is not.
     Icon-only tokens (`--tenue` chevrons) are not measured.
   - The README's contrast table stays the token guard (ADR-0029); the DOM check is the
     authority for what a person reads (ADR-0048).

**New forms, sheets and routes** (review): a new form, sheet, confirmation or shared
`Estados` state is added to the walked states (`WalkState`, in
`web/src/mobile-standard/states*.ts`), so the check visits it; a new route is registered in
`scripts/design/screens.json`, and a front route missing from it fails the check. A walk
step that cannot reach its screen is reported as `unreachable`, never skipped.

**The offender list.** A failure the app has today is listed, never skipped:
`web/src/mobile-standard/offenders/<rule>.json`, one file per rule, each entry one screen,
rule, target and issue (an area issue from the fixed map #45-#49, #59, #60, #78), with
optional `sizes` and `themes`. It can only shrink: the run fails on a new offender, on an
entry whose cell now passes, and on an entry with no valid issue number. It grows only
by a trade, or by the real cells of a row new to the screens registry (the conditions are in
`docs/product/gate.md`). There is no
network lookup; review checks that the number is a real, open area issue. An area issue is
not done while its own screens are still on the list. The list is valid only against the
pinned fixture and date (ADR-0048); a change to either is a change to the lists, in the
same diff. One rule has no file: `tabular-figures` (a figure outside its figure class) is
fixed, never listed, and the loader refuses an entry for it.

**Attached.** Every area PR (#45-#49, #59, #60, #78) attaches the check's result: the
`mobile` project of `npm --prefix web run e2e`, and the offender counts that
`scripts/design/compare.sh` prints (`COMPARE_MOBILE=1` runs the check there too). The real
keyboard and the real-device pass stay by eye (accounts.md, ADR-0028).

## 11. Database naming

`tests/migrations/test_naming.py` machine-checks every rule below stated as **checked**,
against a real SQLite schema reflected two ways (`upgrade_to_head` and
`app.tables.metadata.create_all`), never against an object's `.name` in the metadata. A
name on its allowlist is a known break, not a rule: #75 renames it, so it is never
renamed as a side effect of another task, and no task other than #75 touches the
allowlist.

### Checked

- Lowercase `snake_case` for every table, column, index and constraint name
  (`^[a-z][a-z0-9]*(_[a-z0-9]+)*$`).
- A boolean column starts with `is_` (`is_vip`, `is_shown`), and only a boolean column
  does.
- `_on` names a calendar date (`spent_on`), and only a date column ends in `_on`.
- `_at` names a moment in time (`created_at`), and only a datetime column ends in `_at`.
- A foreign key to `<t>.id` is `<t>_id`, or ends in `_<t>_id` when it needs a role
  prefix (`assigned_app_user_id` referencing `app_user`), matched on whole
  `_`-separated segments, so `wholesale_id` against `sale` fails. A foreign key to a
  column other than `id` (only possible inside a composite key) carries that column's
  own name instead. `_id` alone does not imply a foreign key (`pinned_catalog.message_id`
  is not one, and passes).
- Every table's primary key is the single column `id`.
- Names follow their pattern exactly: `ix_<table>_<columns>` for an index,
  `uq_<table>_<columns>` for a unique constraint, `pk_<table>` for a primary key, and
  `fk_<table>_<first column>_<referenced table>` for a foreign key (columns joined by
  `_`, in their declared order).
- A check constraint's name starts with `ck_<table>_` and is itself `snake_case`.
- A unique, primary-key, foreign-key or check constraint always reflects with a name;
  one that does not is a break on its own.

### Review-only (not machine-checked)

- Singular table names (`customer`, not `customers`); a junction table is `<a>_<b>`,
  with its own surrogate `id` and a `uq_<a>_<b>_<a>_id_<b>_id` on the pair.
- `catalog_attributes` keeps its plural name until #75: no code can flag it, since the
  rules above have nothing to say about plurals.
- No `_until`, `_from` or `_start` for a moment in time or a calendar date (`_at` and
  `_on` say both, with no third option): a reviewer reads it, since a column bearing one
  of these and no date or datetime type (where the `_on`/`_at` rules would already catch
  it) is not something the reflected schema alone can tell apart from an ordinary
  integer or string column of the same name.

### How a table class states a name

- A table class never passes `name=` to a constraint or an index: `NAMING_CONVENTION`
  (`app/db.py`) fills it in from the convention above. A check constraint passes only
  its short rule name (the convention adds the `ck_<table>_` prefix). A composite index
  is declared `Index(None, "a", "b")`, never with a literal name. Its migration spells
  the convention's name out with `op.f(...)`, since Alembic cannot recompute a
  naming-convention name from a bare string.
- A new column's mapped attribute has the column's own name.

### Scope

- §11 applies to every new table, column, index and constraint, and to the ones a task
  otherwise touches — except a name already on `test_naming.py`'s allowlist, which stays
  as it is even when the task changes its column. Only #75 removes an allowlist entry;
  no other task adds or empties one.
- A new index or unique constraint added on an allowlisted column is still named from
  that column's current (unrenamed) name, e.g. `ix_sale_business_id_sale_date` next to
  the allowlisted `sale.sale_date`.
- Old and new names coexist until #75: new code says `app_user_id` while
  `reset_link.user_id` stays as it is, and a new date column ends in `_on` while
  `sale.sale_date` stays `sale_date`. Existing hand-written names
  (`uq_customer_business_phone`, `expense`'s two indexes) are not rewritten either.
