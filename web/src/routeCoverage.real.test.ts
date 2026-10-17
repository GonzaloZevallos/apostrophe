/**
 * `router.routes` against `scripts/design/screens.json`. It lives beside the router, not
 * in `mobile-standard/`: reading the real route table needs `router.tsx`, which imports
 * React, and that folder holds no React import (the pure logic is in
 * `mobile-standard/routeCoverage.ts`).
 */

import { expect, test } from 'vitest'
import { REGISTRY } from './mobile-standard/registry.ts'
import {
  flattenRoutes,
  NOT_SCREENS,
  patternsMatch,
  unregistered,
  UNREGISTERED_ROUTES,
} from './mobile-standard/routeCoverage.ts'
import { redirects } from './redirects'
import { router } from './router'

const registryRoutes = REGISTRY.flatMap((screen) => (screen.route === null ? [] : [screen.route]))
const patterns = flattenRoutes(router.routes)

test('every route the router renders is a registry route or excused', () => {
  expect(patterns.length).toBeGreaterThan(20)
  expect(unregistered(patterns, registryRoutes)).toEqual([])
})

test('every excuse names a pattern the router really has', () => {
  for (const pattern of [...Object.keys(NOT_SCREENS), ...Object.keys(UNREGISTERED_ROUTES)]) {
    expect(patterns).toContain(pattern)
  }
})

test('NOT_SCREENS lists exactly the catch-all and the redirect table', () => {
  expect(Object.keys(NOT_SCREENS).sort()).toEqual(['*', ...redirects.map((r) => r.from)].sort())
})

test('no unregistered-route entry is covered by the registry now', () => {
  for (const pattern of Object.keys(UNREGISTERED_ROUTES)) {
    expect(registryRoutes.some((route) => patternsMatch(pattern, route))).toBe(false)
  }
})
