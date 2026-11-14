/**
 * The Home first-use guard on input it must reject and input it must accept. The real tree is
 * in `homeFirstRun.real.test.ts`.
 */

import { expect, test } from 'vitest'
import { findHomeFirstRunImports, type Source } from './homeFirstRun'

function find(path: string, content: string): string[] {
  const file: Source = { path, content }
  return findHomeFirstRunImports([file])
}

test('Home importing api/firstRun is found, whatever the import form', () => {
  expect(find('src/screens/Inicio.tsx', "import { firstRunQuery } from '../api/firstRun'")).toEqual([
    'src/screens/Inicio.tsx:1: Home imports api/firstRun, but shows no first-use notice',
  ])
  expect(find('src/screens/Inicio.tsx', "import type { FirstRun } from '../api/firstRun'")).toHaveLength(1)
  expect(find('src/screens/Inicio.tsx', "const m = await import('../api/firstRun')")).toHaveLength(1)
})

test('Home importing api/onboarding is found, in Inicio.tsx and in the files under screens/inicio/', () => {
  expect(find('src/screens/Inicio.tsx', "import { progressQuery } from '../api/onboarding'")).toEqual([
    'src/screens/Inicio.tsx:1: Home imports api/onboarding, but shows no first-use notice',
  ])
  expect(
    find('src/screens/inicio/InicioPanel.tsx', "import x from 'react'\nimport { progressQuery } from '../../api/onboarding'"),
  ).toEqual(['src/screens/inicio/InicioPanel.tsx:2: Home imports api/onboarding, but shows no first-use notice'])
})

test('a third reader of api/firstRun is found; the Shell and Products are the named ones', () => {
  expect(find('src/screens/Ventas.tsx', "import { firstRunQuery } from '../api/firstRun'")).toEqual([
    'src/screens/Ventas.tsx:1: api/firstRun is read only by src/shell/Shell.tsx and src/screens/Variedades.tsx',
  ])
  expect(find('src/shell/Shell.tsx', "import { firstRunQuery } from '../api/firstRun'")).toEqual([])
  expect(find('src/screens/Variedades.tsx', "import { firstRunQuery } from '../api/firstRun'")).toEqual([])
})

test('Onboarding may read its own api, and tests and the api folder are not scanned', () => {
  expect(find('src/screens/onboarding/StockStep.tsx', "import { progressQuery } from '../../api/onboarding'")).toEqual([])
  expect(find('src/screens/Inicio.test.tsx', "import { progressQuery } from '../api/onboarding'")).toEqual([])
  expect(find('src/api/keys.ts', "import type { FirstRun } from './firstRun'")).toEqual([])
  expect(find('src/screens/Inicio.tsx', "import { panelQuery } from '../api/panel'")).toEqual([])
})
