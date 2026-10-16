/** `findPlusBesideAgregar` over the real tree: a visible "+" beside the `agregar` icon fails here. */

import { expect, test } from 'vitest'
import { findPlusBesideAgregar } from './plusBesideAgregar'

const modules = import.meta.glob(['/src/**/*.{ts,tsx}'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

function isTestFile(path: string): boolean {
  return /\.test\.tsx?$/.test(path) || path.includes('/architecture/')
}

test('no screen or component draws a literal "+" beside the agregar icon', () => {
  const files = Object.entries(modules)
    .filter(([path]) => !isTestFile(path))
    .map(([path, content]) => ({ path: path.replace(/^\//, ''), content }))
  expect(files.some(({ path }) => path === 'src/screens/Mas.tsx')).toBe(true)
  expect(findPlusBesideAgregar(files)).toEqual([])
})
