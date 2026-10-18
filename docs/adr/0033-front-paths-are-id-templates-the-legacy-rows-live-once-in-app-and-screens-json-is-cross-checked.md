---
status: accepted
date: 2026-10-07
---

# Front paths are `{id}` templates, the legacy rows live once in `app/`, and `screens.json` is cross-checked with no exemption

Supersedes ADR-0030. Builds on ADR-0024's amendment of GH-59.

GH-47 (ADR-0030) and GH-59 (ADR-0024's amendment) each built a way to serve a front path
that carries an id and to redirect an old path with its id: anchored regular expressions
(`SHARED_FRONT_PATTERNS`, `LEGACY_FRONT_PATTERNS`, `contract.json`'s `sharedFrontRoutes`)
and `{id}` templates matched by `matches_template`. Two mechanisms for one job, and a
legacy list written in more than one place, let a path be served by one and missed by the
other. GH-59's templates win; this ADR says what that leaves.

## Decision

- **One grammar.** Every shared front path and every legacy row is a template of
  `/`-separated segments, each a literal or `{id}`, which matches ASCII digits only
  (ADR-0024's amendment). `matches_template` is the only matcher. The four `/varieties`
  paths GH-47 added join `SHARED_FRONT_PATHS`: `/varieties/new`, `/varieties/{id}/prices`,
  `/varieties/{id}/prices/new` and `/varieties/{id}/entries`. A variety is named by its
  integer id, never by its name or by a slug.
- **The legacy rows live once, in `app/legacy_front_paths.json`**: a list of
  `{"old": "/variedades/{id}", "now": "/varieties/{id}"}`. `app/static_spa.py` reads it at
  import into `LEGACY_FRONT_PATHS` and validates it: every segment is a literal or `{id}`,
  `{id}` appears in `now` only when `old` has it (there would be nothing to carry), the
  file holds exactly `old` and `now` per row, and no `old` is listed twice. A malformed
  file raises `MalformedLegacyFrontPaths` at import, so a bad deploy fails to start instead
  of answering a wrong redirect. No other legacy list exists in `app/`, `tests/` or `web/`:
  the e2e spec reads this same file. A hit, or it plus one trailing slash, is a 308 for any
  method and any `Accept`, keeping the query string, with the id carried across.
- **The server reads front paths only from inside `app/`.** `scripts/design/screens.json`
  and `docs/` are design material: tests read them, the server never does at runtime.
- **A hand-written fixture says what must have a row.** `tests/fixtures/legacy_front_paths.json`
  lists every old path a seller could have bookmarked, written by hand and never derived
  from the app's file. A test fails for any fixture path no row covers, so deleting a row
  fails.
- **`screens.json` is cross-checked with no exemption list.** One normaliser reads every
  `{name}` (and the front's `:name`) as `{id}`, so `/sales/{owing_sale}` equals
  `/sales/{id}`. Every `SHARED_FRONT_PATHS` template and every legacy `now` must be a
  normalised path of `screens.json`. Screens with no design file of their own
  (`/customers/new`, `/customers/{id}/edit`, `/varieties/entries/{id}`) are entries of its
  `registry` list, each with a kind and its parent's path, so nothing is exempt. The
  front's registry agrees with the file on path, kind and parent, and a kind or a parent
  changes in both in the same diff.
- **The regex guarantee is replaced by two pinned facts.** For each shared template, its
  `{id}`→`7` sample matches that template and no other, and no literal shared path is
  matched by an `{id}` template (pytest); in the router, a static segment outranks a
  dynamic one (vitest over the real route objects). So `new`, `entries` and `catalog` can
  never fill an id.
- **Removed:** `SHARED_FRONT_PATTERNS`, `LEGACY_FRONT_PATTERNS`, their tests, and
  `contract.json`'s `sharedFrontRoutes`. `frontSegments` stays, and the intersection of
  the API's first segments with it may only hold first segments of `SHARED_FRONT_PATHS`
  (`tests/test_refusal_codes.py`).
- **The ADR-0024 gate is unchanged.** Only `GET`/`HEAD` with `Accept` containing
  `text/html` gets the shell, from the same `SpaStatic`; every other request reaches the
  API untouched.

## What it widens (CODING_STANDARDS §8)

A browser navigation to the four new `/varieties` templates now gets the static shell,
which holds no data and goes to anyone, signed in or not, as every front path already
does, instead of the API's answer. Every non-navigation request reaches the API as before.
Cost: a constant number of template comparisons per request, over a list that does not
grow with data.

## Alternatives rejected

- **Keeping the anchored patterns for varieties and templates for the rest.** Two
  matchers and two places for a legacy list, the problem this ADR removes.
- **Reading `screens.json` at runtime for the paths.** The server would then depend on a
  design file outside `app/`, which a deploy need not ship.
- **An exemption list for screens with no design file.** It hides a missing screen as
  easily as a missing design; the `registry` list names them instead.

## Risk

A front route under an API segment added without its template answers the API's JSON on
reload. The `screens.json` cross-check and the shell-or-API grid in `tests/test_serving.py`
catch a template that is missing from `SHARED_FRONT_PATHS` on the server side; the front's
registry check catches one that is missing from the front.

## Amendment (GH-134): the fixture pins each old path and its target

**Supersedes** the bullet "A hand-written fixture says what must have a row". A fixture that
only listed old paths left a wrong target passing: the redirect test walked the app's own
rows and compared each with the target the same file names.

- `tests/fixtures/legacy_front_paths.json` pins every old path **and its target**, as
  `rows` of `{old, now}` with `{id}` kept literal. It is written by hand from the 20-row
  table of ADR-0024's amendment and is never generated from the app file.
- Only tests read it, through `tests/legacy_pin.py` (standard library only, never `app.*`),
  whose parser refuses a duplicate `old`, a missing or extra key, a non-string value and a
  non-empty `removed`.
- `tests/test_static_spa.py` compares it row for row with the app's rows, on the raw
  templates before any id is substituted.
- `tests/test_serving.py` compares the served `Location` against it.
- `app/legacy_front_paths.json` stays the only list the server serves and the e2e spec
  reads.

Risk: one commit that edits a target in both files passes. Review, guided by this
amendment, is the guard. A mistake made in both ADR-0024's table and the app file would be
pinned wrongly.
