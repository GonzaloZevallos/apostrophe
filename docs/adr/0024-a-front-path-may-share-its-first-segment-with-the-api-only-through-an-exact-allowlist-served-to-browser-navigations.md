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

## Amendment (2026-10-06, GH-59): whole-path templates, the English routes and every old Spanish path

**Supersedes** the "An allowlist as data" and "A legacy table as data" bullets above, and
the sentence "Nothing is matched by prefix, so `/expenses/5` ... keep being the API's".
Everything else in the Decision (the `Accept` gate, the slash rule, the one layer outside
routing, the replaced contract test) stands. The English routes of the navigation
redesign put `/sales`, `/customers` and `/varieties` on first segments the API also
names, and the details with an id (`/sales/{id}`, `/customers/{id}`, `/varieties/{id}`)
need a pattern, not an exact path.

### The template grammar

A template is a path of `/`-separated segments. Each segment is a literal, or the single
placeholder `{id}`, which matches one or more ASCII digits (`[0-9]+`) and nothing else.
`matches_template(path, template)` in `app/static_spa.py` compares the whole path segment
by segment: no prefix, no regex, no other placeholder. The same segment count is
required, and an empty segment never matches. It returns the captured id (or `None` for
no match), and it is the only place a request path is matched against a front path, for
both tables below. The literals `new`, `catalog`, `entries`, `edit` and `payment` are
never an id, so `/customers/new` is a form and never customer `new`.

### `SHARED_FRONT_PATHS`

A frozenset of templates, served the shell under the same gate as before (`GET`/`HEAD`
with `Accept` containing `text/html`; the same path plus one slash is a 308 to the
slashless path):

- `/sales`, `/sales/new`, `/sales/{id}`
- `/customers`, `/customers/new`, `/customers/{id}`, `/customers/{id}/edit`,
  `/customers/{id}/payment`
- `/varieties`, `/varieties/{id}`, `/varieties/catalog`, `/varieties/entries`,
  `/varieties/entries/new`, `/varieties/entries/{id}`
- `/expenses`, `/expenses/new`
- `/analysis`

### `LEGACY_FRONT_PATHS`

A tuple of (old template, new template) pairs. A hit, or the old path plus one trailing
slash, answers 308 for any method and any `Accept`, carries the captured id into the new
path and keeps the query string. A Spanish path that matches no row (`/ventas/basura`) is
not redirected: the front's own `*` route sends it to Inicio. The 20 rows:

| Old | New |
| --- | --- |
| `/ventas` | `/sales` |
| `/ventas/nueva` | `/sales/new` |
| `/ventas/{id}` | `/sales/{id}` |
| `/clientes` | `/customers` |
| `/clientes/deben` | `/customers` |
| `/clientes/nuevo` | `/customers/new` |
| `/clientes/{id}` | `/customers/{id}` |
| `/clientes/{id}/editar` | `/customers/{id}/edit` |
| `/mi-stock` | `/varieties` |
| `/mi-stock/nueva-entrada` | `/varieties/entries/new` |
| `/mi-stock/entradas/{id}` | `/varieties/entries/{id}` |
| `/variedades` | `/varieties` |
| `/variedades/{id}` | `/varieties/{id}` |
| `/analisis` | `/analysis` |
| `/gastos` | `/expenses` |
| `/gastos/categorias` | `/settings/expense-categories` |
| `/mas` | `/more` |
| `/catalogo` | `/varieties/catalog` |
| `/negocio` | `/settings` |
| `/entrar` | `/login` |

Front code never redirects a Spanish path: this table is the only place one is.

### What it widens (section 8)

Anyone, signed in or not, who opens one of these API-shaped URLs in a browser's address
bar now gets the static shell, which holds no data. No API consumer sends `text/html`:
`api/client.ts` sends `application/json`, and TestClient, httpx and curl send `*/*`, so
no JSON caller is shadowed and the API's answer to every other method or `Accept` is
unchanged. The cost is constant, a few string comparisons per request, and does not grow
with data. No route is added: the OpenAPI document is unchanged.

### Rows that lose something

A 308 is cached by browsers and cannot be undone from the server. Three rows send a
whole old screen to a place that is not its twin, and stay as they are for good:

- `/clientes/deben` → `/customers`: the old Te deben list is now Clientes.
- `/mi-stock` → `/varieties`: the stock list now lives at `/varieties/entries`; the old
  address lands on Variedades.
- `/entrar` → `/login`: the sign-in screen's English path.

### Contract test

`tests/test_refusal_codes.py` keeps the rule: the API's first segments intersected with
`contract.json`'s `frontSegments` must be first segments of `SHARED_FRONT_PATHS`.
`sales`, `customers`, `varieties`, `analysis` and `login` join `frontSegments`.
