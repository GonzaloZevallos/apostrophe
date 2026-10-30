/**
 * `router.routes` against `scripts/design/screens.json` → `registry[]`. It lives beside the
 * router, not in `mobile-standard/`: it is not a browserless guard. `router.tsx` calls
 * `createBrowserRouter` at import, which needs `document` (under vitest's node
 * environment the import fails with "document is not defined") and imports React; the
 * pure logic it uses is in `mobile-standard/routeCoverage.ts`.
 */

import { expect, test } from 'vitest'
import { ROUTE_REGISTRY } from './mobile-standard/registry.ts'
import { flattenRoutes, NOT_SCREENS, patternsMatch, redirectExcuses, unregistered } from './mobile-standard/routeCoverage.ts'
import { router } from './router'

const registryPaths = ROUTE_REGISTRY.map((entry) => entry.path)
// No front code redirects any more (src/routes.ts), so the redirect table is empty.
const excused = [NOT_SCREENS, redirectExcuses([])]
const patterns = flattenRoutes(router.routes)

test('every route the router renders is a registry[] path or excused', () => {
  expect(patterns.length).toBeGreaterThan(20)
  expect(unregistered(patterns, registryPaths, excused)).toEqual([])
})

test('every excuse names a pattern the router really has', () => {
  for (const pattern of excused.flatMap((list) => Object.keys(list))) {
    expect(patterns).toContain(pattern)
  }
})

test('every registry[] path is a route the router renders', () => {
  const unrouted = registryPaths.filter((path) => !patterns.some((pattern) => patternsMatch(pattern, path)))
  expect(unrouted).toEqual([])
})
