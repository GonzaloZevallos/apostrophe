/**
 * No non-test module imports from `src/test/` (GH-97 invariant 11): the helpers there
 * (`expectIconAndTextRule`) pull `vitest` into whatever imports them, so a screen or a
 * component that did would ship test code. Test files, `architecture/` and the two
 * setup modules (`test-setup.ts`, `test-viewport.ts`) are the importers allowed.
 *
 * `testImporters` is the check; the second test feeds it input it must reject. The first
 * runs it over the real tree.
 */

import { expect, test } from 'vitest'

interface Source {
  path: string
  content: string
}

const IMPORT_SPECIFIER = /(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g
const FROM_TEST_DIRECTORY = /(^|\/)test(\/|$)/

function isTestSide(path: string): boolean {
  return (
    /\.test\.tsx?$/.test(path) ||
    path.includes('/architecture/') ||
    path.includes('/src/test/') ||
    /\/src\/test-(setup|viewport)\.ts$/.test(path)
  )
}

function testImporters(files: Source[]): string[] {
  return files
    .filter(({ path }) => !isTestSide(path))
    .filter(({ content }) =>
      Array.from(content.matchAll(IMPORT_SPECIFIER)).some(([, specifier]) =>
        FROM_TEST_DIRECTORY.test(specifier ?? ''),
      ),
    )
    .map(({ path }) => path)
}

const modules = import.meta.glob(['/src/**/*.{ts,tsx}'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

test('no non-test module under src/ imports from src/test/', () => {
  const files = Object.entries(modules).map(([path, content]) => ({ path, content }))
  expect(files.some(({ path }) => path === '/src/test/iconAndTextRule.ts')).toBe(true)
  expect(files.length).toBeGreaterThan(10)
  expect(testImporters(files)).toEqual([])
})

test('an import from src/test/ in a screen or a component is found, a test file is not', () => {
  const imports = "import { expectIconAndTextRule } from '../test/iconAndTextRule'"
  const files = [
    { path: '/src/screens/Ventas.tsx', content: imports },
    { path: '/src/components/Boton.tsx', content: "import('../../test/x')" },
    { path: '/src/components/Boton.test.tsx', content: imports },
    { path: '/src/architecture/a.ts', content: imports },
    { path: '/src/test/other.ts', content: "import { a } from './iconAndTextRule'" },
    { path: '/src/screens/Clientes.tsx', content: "import { x } from '../test-setup'" },
    { path: '/src/screens/Gastos.tsx', content: "import Boton from '../components/Boton'" },
  ]
  expect(testImporters(files)).toEqual(['/src/screens/Ventas.tsx', '/src/components/Boton.tsx'])
})
