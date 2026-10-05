---
status: accepted
date: 2026-10-05
---

# A front path may share its first segment with the API only through an exact allowlist served to browser navigations

The front's Gastos screens live at `/expenses` and `/expenses/new` (GH-48, the PRD's
paths), but `/expenses` is also the first segment of the expenses API router. Starlette
matches routes before the `/` mount that serves the built front (`app/static_spa.py`),
so a reload on `/expenses` would get the API's JSON (a 401 signed out), not the app.
The Spanish paths `/mas` and `/gastos` that the front used until now must keep
working for bookmarks.

## Decision

- **An allowlist as data.** `SHARED_FRONT_PATHS` in `app/static_spa.py` lists the exact
  paths where the front is served although the API names the first segment:
  `/expenses` and `/expenses/new`. Nothing is matched by prefix, so `/expenses/5` and
  every other API path keep being the API's.
- **A legacy table as data.** `LEGACY_FRONT_PATHS` maps `/mas` to `/more` and `/gastos`
  to `/expenses`. A hit, or the same path plus one trailing slash, answers 308 for any
  method and any `Accept`, keeping the query string. The router has no Spanish redirect
  routes.
- **The `Accept` gate.** A shared path is served `index.html` only for `GET` or `HEAD`
  whose `Accept` contains `text/html` (what a browser navigation sends). The front's own
  `api/client.ts` sends `Accept: application/json` on every request, so its API calls
  never get the shell. Any other method or `Accept` reaches the API unchanged.
- **The slash rule.** A shared path plus one trailing slash, for that same navigation,
  is a 308 to the slashless path (the API has no slash variant to redirect to).
- **One layer, outside routing.** `FrontNavigation` is a pure ASGI middleware, added
  last in `create_app`, so it decides on the raw path before Starlette's routing and its
  `redirect_slashes`. It serves the shell through the same `SpaStatic` instance as `/`,
  so the shell's headers (`Cache-Control: no-cache`) have one author. It exists only
  when the built front is served; no route is added, so the OpenAPI document, the
  gated-route test and the isolation sweep do not change.
- **Every moved screen adds its own entry.** `/analysis` and any later screen that moves
  to a path sharing a segment with the API adds its path to `SHARED_FRONT_PATHS` in the
  same change that adds its front route.
- **The replaced contract test.** The old rule "no API first segment is a front
  segment" becomes: the intersection of the API's first segments and `contract.json`'s
  `frontSegments` may only hold segments of `SHARED_FRONT_PATHS`
  (`tests/test_refusal_codes.py`).

## What it widens

A browser navigation to exactly those two paths now gets the static shell instead of the
API's answer. The shell holds no data and goes to anyone, signed in or not, as every
front path already does. Cost does not grow with data.

## Alternatives rejected

- **Moving the API under `/api`.** Every client, test and the deployed contract would
  change for a routing detail of the front.
- **Changing the PRD's paths** (keeping a Spanish or otherwise non-clashing name): the
  paths `/more` and `/expenses` are the product's decision, in English like the code.

## Risk

A future `/expenses/:id` front route answers the API's 404 on reload until its exact
entry is added to `SHARED_FRONT_PATHS`; the entry belongs in the same change as the
route. A screen moved without its entry is caught only by this ADR and the contract
test above.
