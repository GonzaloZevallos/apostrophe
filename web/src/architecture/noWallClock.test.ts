/**
 * No vitest or e2e test file reads the real clock (ADR-0043, amendment web-wall-clock).
 * The real tree is scanned as raw text and must give zero findings; there is no allowlist.
 * A file is exempt only by pinning a literal fake instant (see `wallClock.ts`).
 */

import { expect, it } from 'vitest'
import { findWallClockReads } from './wallClock.js'

const files = {
  ...import.meta.glob(['../**/*.test.ts', '../**/*.test.tsx'], {
    query: '?raw',
    import: 'default',
    eager: true,
  }),
  ...import.meta.glob('../../e2e/**/*.ts', { query: '?raw', import: 'default', eager: true }),
} as Record<string, string>

it('scans the test files it is meant to scan', () => {
  const paths = Object.keys(files)
  expect(paths.some((path) => path.endsWith('/api/keys.test.ts'))).toBe(true)
  expect(paths.some((path) => path.includes('/e2e/') && path.endsWith('fixtures.ts'))).toBe(true)
})

it('finds no real-clock read in any test file', () => {
  const findings = Object.entries(files).flatMap(([path, text]) =>
    findWallClockReads(text).map(({ line, pattern }) => `${path}:${line} ${pattern}`),
  )
  expect(findings).toEqual([])
})
