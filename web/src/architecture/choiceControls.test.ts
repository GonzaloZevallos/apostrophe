/**
 * `fixedSetImportViolations` (GH-581 part 2): `web/src/components/fixedSets.ts` may import only
 * from `src/copy/` and the `NombreIcono` type, so a fixed set can never reach the network, a
 * hook, a query or a setting. One inline fixture per import form, each with the line it fails on.
 */

import { expect, test } from 'vitest'
import { fixedSetImportViolations, fixedSetsSources } from './choiceControls'

const PATH = 'src/components/fixedSets.ts'

function violationsOf(source: string): string[] {
  return fixedSetImportViolations([{ path: PATH, source }]).map(
    (found) => `${found.path}:${found.line} ${found.specifier}`,
  )
}

test('the real fixedSets.ts imports only copy modules and the NombreIcono type', () => {
  const files = fixedSetsSources()
  expect(files.map((file) => file.path)).toEqual([PATH])
  expect(fixedSetImportViolations(files)).toEqual([])
})

test('a file with only copy imports and the exact NombreIcono type import passes', () => {
  const source = [
    "import { PERIOD_TEXT } from '../copy/common'",
    "import { CUSTOMER_TYPE_ICON_NAME } from '../copy/readers/customerTypeIcons'",
    "import type { NombreIcono } from './Icono'",
    '',
    'export const X = PERIOD_TEXT',
  ].join('\n')
  expect(violationsOf(source)).toEqual([])
})

test('an import from api/ fails with its file:line and says why', () => {
  const source = "import { PERIOD_TEXT } from '../copy/common'\nimport { getBusiness } from '../api/business'\n"
  const found = fixedSetImportViolations([{ path: PATH, source }])
  expect(found).toEqual([
    {
      path: PATH,
      line: 2,
      specifier: 'src/api/business',
      reason: 'fixedSets.ts imports from src/api/business; only src/copy/ and the NombreIcono type are allowed',
    },
  ])
})

test('an import type from api/ fails', () => {
  expect(violationsOf("import type { Business } from '../api/business'")).toEqual([
    `${PATH}:1 src/api/business`,
  ])
})

test('an export … from api/ fails, and so does export *', () => {
  const source = "export { x } from '../api/x'\n\nexport * from '../api/y'\n"
  expect(violationsOf(source)).toEqual([`${PATH}:1 src/api/x`, `${PATH}:3 src/api/y`])
})

test('a dynamic import() fails', () => {
  expect(violationsOf("const a = 1\nconst m = await import('../api/x')\n")).toEqual([`${PATH}:2 src/api/x`])
})

test('a dynamic import() of a copy module is judged by its target, like a static one', () => {
  expect(violationsOf("const m = import('../copy/common')")).toEqual([])
})

test('import.meta and a non-literal require() fail closed', () => {
  const source = "const g = import.meta.glob('../api/*')\nconst r = require(name)\n"
  expect(fixedSetImportViolations([{ path: PATH, source }])).toEqual([
    { path: PATH, line: 1, specifier: 'import.meta', reason: 'fixedSets.ts reads import.meta, which is not judged' },
    { path: PATH, line: 2, specifier: 'require(name)', reason: 'fixedSets.ts has a call to require() that cannot be read' },
  ])
})

test('a non-literal dynamic import fails closed', () => {
  const found = fixedSetImportViolations([{ path: PATH, source: 'const m = import(name)\n' }])
  expect(found).toEqual([
    { path: PATH, line: 1, specifier: 'import(name)', reason: 'fixedSets.ts has a call to import() that cannot be read' },
  ])
})

test('a require() fails', () => {
  expect(violationsOf("const x = require('../api/x')")).toEqual([`${PATH}:1 src/api/x`])
})

test('a ../copy/../api/x traversal is resolved before it is judged', () => {
  expect(violationsOf("import { x } from '../copy/../api/x'")).toEqual([`${PATH}:1 src/api/x`])
})

test('a bare package import fails', () => {
  const source = [
    "import { useQuery } from '@tanstack/react-query'",
    "import { useState } from 'react'",
    "import i18next from 'i18next'",
  ].join('\n')
  expect(violationsOf(source)).toEqual([
    `${PATH}:1 @tanstack/react-query`,
    `${PATH}:2 react`,
    `${PATH}:3 i18next`,
  ])
})

test('a side-effect import fails', () => {
  expect(violationsOf("import '../api/boot'")).toEqual([`${PATH}:1 src/api/boot`])
})

test('a hook module and a settings module fail', () => {
  const source = "import { useSettings } from '../hooks/useSettings'\nimport { read } from '../settings/store'\n"
  expect(violationsOf(source)).toEqual([`${PATH}:1 src/hooks/useSettings`, `${PATH}:2 src/settings/store`])
})

test('a value import from ./Icono fails; only the type import is allowed', () => {
  expect(violationsOf("import { Icono } from './Icono'")).toEqual([`${PATH}:1 src/components/Icono`])
})

test('an inline type specifier on a value import from ./Icono fails', () => {
  expect(violationsOf("import { type NombreIcono } from './Icono'")).toEqual([`${PATH}:1 src/components/Icono`])
})

test('a type import of anything else from ./Icono fails', () => {
  expect(violationsOf("import type { Icono } from './Icono'")).toEqual([`${PATH}:1 src/components/Icono`])
})

test('a commented-out import is not an import', () => {
  expect(violationsOf("// import { x } from '../api/x'\n/* import y from '../api/y' */\n")).toEqual([])
})

test('a multi-line import is judged at the line of its import keyword', () => {
  const source = "import {\n  a,\n  b,\n} from '../api/x'\n"
  expect(violationsOf(source)).toEqual([`${PATH}:1 src/api/x`])
})
