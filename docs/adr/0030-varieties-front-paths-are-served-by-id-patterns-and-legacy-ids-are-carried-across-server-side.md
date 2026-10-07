---
status: superseded by 0031
date: 2026-10-06
---

# Varieties front paths are served by exact paths and id patterns, and legacy ids are carried across server side

Amends ADR-0024.

The redesigned Variedades (GH-47) lives under `/varieties`, the first segment of the
varieties API router. Some of its screens carry a record's id in the path
(`/varieties/7`, `/varieties/7/prices`, `/varieties/entries/7`), and each is also an API
path (`GET /varieties/7`, `GET /varieties/7/prices`). ADR-0024's exact allowlist cannot
list a parameterised path, and a reload on any of them must open the screen, never the
API's JSON. The old `/variedades/{n}` and `/mi-stock/entradas/{n}` must also keep working
for bookmarks, with the id carried to the new path.

## Decision

- **`{low}` is the variety's integer id**, not a slug. A rename never breaks a link, and
  because only digits match, no variety can collide with `catalog`, `entries` or `new`.
  The business is never in a path (ADR-0004); a record's id is.
- **Exact shared paths stay exact.** `SHARED_FRONT_PATHS` gains `/varieties`,
  `/varieties/new`, `/varieties/catalog`, `/varieties/entries` and
  `/varieties/entries/new`.
- **A closed tuple of patterns.** `SHARED_FRONT_PATTERNS` in `app/static_spa.py`:
  `^/varieties/[0-9]+$`, `^/varieties/[0-9]+/prices$`, `^/varieties/[0-9]+/prices/new$`,
  `^/varieties/[0-9]+/entries$` and `^/varieties/entries/[0-9]+$`. Every pattern is fully
  anchored, is matched with `fullmatch` (so a trailing newline never passes `$`), and its
  only variable is the literal `[0-9]+` (ASCII digits, never `\d`). A test refuses any
  pattern that is not anchored or has another variable (`tests/test_refusal_codes.py`).
  Anything else, `/varieties/7a`, `/varieties/7/entries/x`, stays the API's.
- **The ADR-0024 gate is unchanged.** Only `GET` or `HEAD` with `Accept: text/html` gets
  the shell, from the same `SpaStatic`; a shared path (exact or by pattern) plus one
  trailing slash is a 308 to the slashless path; every other method or `Accept` reaches the
  API untouched.
- **Legacy ids are carried across server side.** `LEGACY_FRONT_PATHS` stays exact. A new
  `LEGACY_FRONT_PATTERNS` is a tuple of `(anchored pattern, target)` rows, the target using
  the captured id (`/variedades/{n}` to `/varieties/{n}`, `/mi-stock/entradas/{n}` to
  `/varieties/entries/{n}`). A hit, or it plus one trailing slash, is a 308 for any method
  and any `Accept`, keeping the query string. `FrontNavigation` takes the table as an
  argument (defaulting to the production one) so a test injects its own. The rows
  themselves land with the front routes that retire each old screen.
- **`contract.json` gains `sharedFrontRoutes`**: concrete sample paths, ids written as `7`.
  `frontSegments` gains `varieties`. Two checks hold the two sides together: a pytest asks
  for every listed path (the shell for a browser navigation, the API's own answer for
  `Accept: application/json`), and a front test requires every route constant of
  `routes.ts` under an API segment to be listed.
- **The rewritten intersection rule.** The API's first segments, intersected with
  `frontSegments`, may only hold first segments of `SHARED_FRONT_PATHS` or of
  `SHARED_FRONT_PATTERNS`, derived from the tables (`tests/test_refusal_codes.py`).

## What it widens (CODING_STANDARDS §8)

A browser navigation to those exact paths and to a full match of those five patterns now
gets the static shell instead of the API's answer. The shell holds no data and goes to
anyone, signed in or not, as every front path already does. Every non-navigation request,
and every write, reaches the API as before. Cost does not grow with data: five regular
expression matches per request on a shared first segment.

## Alternatives rejected

- **Matching `/varieties/*` by prefix.** It would hide API paths, such as
  `/varieties/7/prices/3`, from a browser.
- **A slug as `{low}`.** A rename would break links and slugs could collide with `new`.
- **Moving the API under `/api`.** As in ADR-0024: every client and the deployed contract
  would change for a routing detail of the front.

## Risk

A front route under an API segment added without its entry answers the API's 404 or JSON
on reload. `sharedFrontRoutes` and the checks above catch it.
