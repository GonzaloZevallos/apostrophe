/**
 * Runs `findRouteLiterals` over the real tree: nothing under `src/` holds a literal
 * route path, except the files that own them. `routes/paths.ts` writes today's
 * values (and its test hard-codes them), `router.tsx` is the route table, and
 * `routes/legacy.ts` with its test is where the old Spanish paths live.
 */

import { expect, test } from 'vitest'
import { findRouteLiterals } from './routeLiterals'

const modules = import.meta.glob('/src/**/*.{ts,tsx}', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

const OWNERS = [
  'src/routes/paths.ts',
  'src/routes/paths.test.ts',
  'src/router.tsx',
  'src/routes/legacy.ts',
  'src/routes/legacy.test.tsx',
]

test('no component, hook or test holds a literal route path', () => {
  const files = Object.entries(modules)
    .map(([rawPath, content]) => ({ path: rawPath.replace(/^\//, ''), content }))
    .filter(({ path }) => !path.includes('/architecture/') && !OWNERS.includes(path))

  expect(files.length).toBeGreaterThan(10)
  expect(findRouteLiterals(files)).toEqual([])
})
