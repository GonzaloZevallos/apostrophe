/** `findHomeFirstRunImports` over the real tree: Home reading the setup endpoints fails here. */

import { expect, test } from 'vitest'
import { FIRST_RUN_READERS, findHomeFirstRunImports } from './homeFirstRun'

const modules = import.meta.glob(['/src/**/*.{ts,tsx}'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

const files = Object.entries(modules).map(([path, content]) => ({ path: path.replace(/^\//, ''), content }))

test('Home imports neither api/firstRun nor api/onboarding, and api/firstRun has its two named readers', () => {
  const paths = files.map(({ path }) => path)
  expect(paths).toContain('src/screens/Inicio.tsx')
  expect(paths.some((path) => path.startsWith('src/screens/inicio/'))).toBe(true)
  for (const reader of FIRST_RUN_READERS) {
    const source = files.find(({ path }) => path === reader)
    expect(source?.content, `${reader} reads api/firstRun`).toMatch(/\/api\/firstRun'/)
  }
  expect(findHomeFirstRunImports(files)).toEqual([])
})
