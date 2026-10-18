/**
 * `router.routes` against `scripts/design/screens.json`. It lives beside the router, not
 * in `mobile-standard/`: it is not a browserless guard. `router.tsx` calls
 * `createBrowserRouter` at import, which needs `document` (under vitest's node
 * environment the import fails with "document is not defined") and imports React; the
 * pure logic it uses is in `mobile-standard/routeCoverage.ts`.
 */

import { expect, test } from 'vitest'
import { REGISTRY } from './mobile-standard/registry.ts'
import {
  flattenRoutes,
  NOT_SCREENS,
  patternsMatch,
  redirectExcuses,
  unregistered,
  UNREGISTERED_ROUTES,
} from './mobile-standard/routeCoverage.ts'
import { router } from './router'

const registryRoutes = REGISTRY.flatMap((screen) => (screen.route === null ? [] : [screen.route]))
// No front code redirects any more (src/routes.ts), so the redirect table is empty.
const excused = [NOT_SCREENS, redirectExcuses([]), UNREGISTERED_ROUTES]
const patterns = flattenRoutes(router.routes)

test('every route the router renders is a registry route or excused', () => {
  expect(patterns.length).toBeGreaterThan(20)
  expect(unregistered(patterns, registryRoutes, excused)).toEqual([])
})

test('every excuse names a pattern the router really has', () => {
  for (const pattern of excused.flatMap((list) => Object.keys(list))) {
    expect(patterns).toContain(pattern)
  }
})

test('no unregistered-route entry is covered by the registry now', () => {
  for (const pattern of Object.keys(UNREGISTERED_ROUTES)) {
    expect(registryRoutes.some((route) => patternsMatch(pattern, route))).toBe(false)
  }
})
