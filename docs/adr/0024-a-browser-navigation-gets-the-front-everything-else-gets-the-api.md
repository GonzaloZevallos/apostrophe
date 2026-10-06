---
status: accepted
date: 2026-10-05
---

# A browser navigation gets the front; everything else gets the API

The navigation redesign (GH-59) gives the front English routes (`/sales`, `/customers`,
`/varieties`, `/expenses`, `/analysis`) that are also API paths. `SpaStatic` is mounted
last, so a `GET /sales` matches the sales router and never reaches it: a reload, a saved
link or the home-screen shortcut would answer 401 or JSON. ADR-0008 required the front's
segments to be disjoint from the API's.

## Decision

- A pure-ASGI middleware, `NavigationFallback` (`app/static_spa.py`), registered only
  when `web_dist` is set and ahead of routing, answers the built `index.html` (with
  `Cache-Control: no-cache`) when the method is GET or HEAD, the request is a browser
  navigation (`Sec-Fetch-Mode: navigate`, or, when that header is absent, `Accept` with
  `text/html` first), the path has no file extension and its first segment is one of the
  front's route segments. Everything else reaches the API unchanged. Credentials play no
  part: the session cookie travels with `fetch` as it does with a navigation.
- `contract.json`'s `frontSegments` splits into `staticSegments` (must stay disjoint from
  the API) and `routeSegments` (every first segment the router owns, English and old
  Spanish; may overlap the API). This amends ADR-0008's disjointness rule.
- `NavigationFallback` wraps `send` and adds `Vary: Sec-Fetch-Mode, Accept` to every answer
  under a `routeSegments` path (the `index.html`, and the API's JSON, 401 and 404), because
  a cache cannot tell the fallback from the API's answer. Paths outside `routeSegments`
  get no added `Vary`. Old Spanish segments stay in `routeSegments` while `legacy.ts`
  names them, with no expiry.
- The front's `client.ts` sends `Accept: application/json` explicitly.
- Old Spanish paths redirect on the client only, from one table; no server 301.

## Consequences

- A navigation to a path that used to answer 401 now gets the public `index.html`.
- `TestClient`, UptimeRobot and `curl` send neither header, so API tests are unchanged.

## Considered and rejected

- **Content negotiation inside `SpaStatic`**: unreachable, API routes match first.
- **Moving the API under `/api`**: touches every router, test, the sweep and the e2e;
  kept as the named end state if the header test proves unreliable.
- **Telling a navigation by the absence of credentials**: `fetch` sends the cookie too.
