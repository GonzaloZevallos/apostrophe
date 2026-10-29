/**
 * No test file under `src/` sets an async timeout below the ceiling of `src/test/asyncTimeout.ts`.
 * The scanner itself is proven on its inputs in `asyncTimeouts.test.ts`.
 */

import { expect, test } from 'vitest'
import { findShortAsyncTimeouts } from './asyncTimeouts'

const modules = import.meta.glob(['/src/**/*.test.ts', '/src/**/*.test.tsx', '!/src/architecture/**'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

test('no test file under src/ sets an async timeout below the ceiling', () => {
  const files = Object.entries(modules).map(([path, content]) => ({ path, content }))
  expect(files.some(({ path }) => path === '/src/screens/expenses/ExpenseNewRoute.test.tsx')).toBe(true)
  expect(files.some(({ path }) => path.startsWith('/src/architecture/'))).toBe(false)
  expect(findShortAsyncTimeouts(files)).toEqual([])
})
