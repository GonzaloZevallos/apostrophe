/**
 * ProductResultsTable is not routed (GH-870): no non-test module under `src/` imports it until the
 * flip part of GH-496, which deletes this test. Fails on a static import, a re-export or a dynamic
 * `import()` of it from any module that is not a test.
 */

import { expect, test } from 'vitest'

interface Source {
  path: string
  content: string
}

const IMPORT_OF_TABLE = /(?:from|import)\s*\(?\s*['"][^'"]*\/ProductResultsTable(?:\.tsx)?['"]/

function isTest(path: string): boolean {
  return /\.test\.tsx?$/.test(path)
}

/** The non-test modules whose source imports ProductResultsTable. */
function importersOfTable(files: readonly Source[]): string[] {
  return files
    .filter(({ path, content }) => !isTest(path) && IMPORT_OF_TABLE.test(content))
    .map(({ path }) => path)
}

const modules = import.meta.glob(['/src/**/*.ts', '/src/**/*.tsx'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

test('the checker names a module that imports the table, statically or dynamically', () => {
  const files = [
    { path: 'src/App.tsx', content: "import ProductResultsTable from './screens/ventas/ProductResultsTable'" },
    { path: 'src/Lazy.tsx', content: "const T = lazy(() => import('./screens/ventas/ProductResultsTable'))" },
    { path: 'src/Other.tsx', content: "import './screens/ventas/ProductResultsTable.css'" },
    { path: 'src/screens/ventas/ProductResultsTable.test.tsx', content: "import T from './ProductResultsTable'" },
  ]
  expect(importersOfTable(files)).toEqual(['src/App.tsx', 'src/Lazy.tsx'])
})

test('no non-test module under src imports ProductResultsTable', () => {
  const files = Object.entries(modules).map(([path, content]) => ({ path: path.replace(/^\//, ''), content }))
  expect(files.some(({ path }) => path === 'src/screens/ventas/ProductResultsTable.tsx')).toBe(true)
  expect(importersOfTable(files)).toEqual([])
})
