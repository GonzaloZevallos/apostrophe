/**
 * `fixedSetImportViolations` (GH-581 part 2): `web/src/components/fixedSets.ts` may import only
 * from `src/copy/` and the `NombreIcono` type, so a fixed set can never reach the network, a
 * hook, a query or a setting. One inline fixture per import form, each with the line it fails on.
 */

import { expect, test } from 'vitest'
import type { RawChipSite } from '../components/fixedSets'
import {
  callSiteSources,
  fixedSetCallSiteViolations,
  fixedSetImportViolations,
  fixedSetsSources,
  selectViolations,
} from './choiceControls'

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

// ---- call-site rules (GH-581 part 7) ---------------------------------------------------

const SITE_PATH = 'src/screens/settings/AppearanceGroup.tsx'
const THEME_SITE: RawChipSite = { file: SITE_PATH, set: 'THEME_CHOICES', reason: 'fixture' }
const THEME_IMPORT = "import { THEME_CHOICES } from '../../components/fixedSets'\n"

function callSiteOf(path: string, source: string, sites: readonly RawChipSite[] = path === SITE_PATH ? [THEME_SITE] : []): string[] {
  return fixedSetCallSiteViolations([{ path, source }], sites).map((found) => `${found.path}:${found.line} ${found.reason}`)
}

const MAPPED_PRESSED = (receiver: string) =>
  [`<div>{${receiver}.map((option) => (`, '  <button aria-pressed={on}>{option.label()}</button>', '))}</div>'].join('\n')

test('the real tree has no chip control outside the registered sites and no native select', () => {
  const files = callSiteSources()
  expect(files.length).toBeGreaterThan(100)
  expect(fixedSetCallSiteViolations(files)).toEqual([])
  expect(selectViolations(files)).toEqual([])
})

test('an aria-pressed map over data fails with its file:line outside the allowed files', () => {
  const source = '<div>\n{items.map((item) => (\n  <button aria-pressed={item.on}>{item.name}</button>\n))}\n</div>'
  expect(callSiteOf('src/screens/Algo.tsx', source)).toEqual([
    'src/screens/Algo.tsx:3 aria-pressed outside SegmentedChoice, Pestanas and the raw sites of RAW_CHIP_SITES; a choice over a set takes a FixedSet or the Selector',
  ])
})

test('role radio, role tab and a bare chip class each fail outside the allowed files', () => {
  const source = ['<a role="radio" />', "<b role='tab' />", '<i role={\'radio\'} />', '<u className="pildora pildora--activa" />'].join('\n')
  const found = callSiteOf('src/screens/Algo.tsx', source)
  expect(found.map((line) => line.split(' outside ')[0])).toEqual([
    'src/screens/Algo.tsx:1 role="radio"',
    "src/screens/Algo.tsx:2 role='tab'",
    "src/screens/Algo.tsx:3 role={…} that can be radio",
    'src/screens/Algo.tsx:4 the chip class pildora',
    'src/screens/Algo.tsx:4 the chip class pildora--activa',
  ])
})

test('ajustes-tema__opcion buttons mapped over data with no role fail', () => {
  const source = "<div>{languages.map((l) => <button className={'ajustes-tema__opcion'}>{l}</button>)}</div>"
  expect(callSiteOf('src/screens/Otra.tsx', source)).toHaveLength(1)
  expect(callSiteOf('src/screens/Otra.tsx', source)[0]).toMatch(/^src\/screens\/Otra\.tsx:1 the chip class ajustes-tema__opcion outside/)
})

test('SegmentedChoice and Pestanas may carry the markers', () => {
  const source = '<button role="radio" aria-pressed className="selector-pago__opcion" />'
  expect(callSiteOf('src/components/SegmentedChoice.tsx', source)).toEqual([])
  expect(callSiteOf('src/components/Pestanas.tsx', source)).toEqual([])
})

test('fecha-pildora and origen-pildoras are not chip classes', () => {
  const source = '<span className="fecha-pildora"><input className="fecha-pildora__input" /></span><div className="origen-pildoras" />'
  expect(callSiteOf('src/screens/ventas/NuevaVenta.tsx', source)).toEqual([])
})

test('a role={…} is judged by the values it can take', () => {
  const readable = [
    "type P = { role?: 'status' | 'alert' }",
    '<div role={role} />',
    "<div role={on ? 'dialog' : undefined} />",
    "<div role={a ? 'x' : b ? 'listbox' : 'group'} />",
  ].join('\n')
  expect(callSiteOf('src/components/Algo.tsx', readable)).toEqual([])
  expect(callSiteOf('src/components/Algo.tsx', "<div role={on ? 'radio' : undefined} />")).toHaveLength(1)
  const unreadable = callSiteOf('src/components/Algo.tsx', '<div role={props.mystery} />')
  expect(unreadable).toHaveLength(1)
  expect(unreadable[0]).toMatch(/^src\/components\/Algo\.tsx:1 a role=\{…\} whose value cannot be read outside/)
})

test('a raw site mapping its registered set passes, directly, filtered, or through an alias', () => {
  const direct = THEME_IMPORT + MAPPED_PRESSED('THEME_CHOICES')
  expect(callSiteOf(SITE_PATH, direct)).toEqual([])
  const filtered = THEME_IMPORT + MAPPED_PRESSED('THEME_CHOICES.filter((o) => o.value !== "dark")')
  expect(callSiteOf(SITE_PATH, filtered)).toEqual([])
  const aliased = "import { THEME_CHOICES as CHOICES } from '../../components/fixedSets'\n" + MAPPED_PRESSED('CHOICES')
  expect(callSiteOf(SITE_PATH, aliased)).toEqual([])
  const chained = THEME_IMPORT + '<div>{THEME_CHOICES\n  .filter((o) => o)\n  .map((o) => <i aria-pressed />)}</div>'
  expect(callSiteOf(SITE_PATH, chained)).toEqual([])
})

test('a raw site mapping a local array fails with the line of the control', () => {
  const source = THEME_IMPORT + 'const segments = [1, 2]\n' + MAPPED_PRESSED('segments')
  expect(callSiteOf(SITE_PATH, source)).toEqual([
    `${SITE_PATH}:4 aria-pressed is inside a .map over segments, which is not imported from components/fixedSets`,
  ])
})

test('a raw site mapping a prop fails', () => {
  expect(callSiteOf(SITE_PATH, THEME_IMPORT + MAPPED_PRESSED('props.options'))).toEqual([
    `${SITE_PATH}:3 aria-pressed is inside a .map over props.options; only THEME_CHOICES (or a direct .filter of it) may be mapped here`,
  ])
})

test('a raw site mapping a spread of its set fails', () => {
  const source = THEME_IMPORT + MAPPED_PRESSED('[...THEME_CHOICES, extra]')
  expect(callSiteOf(SITE_PATH, source)).toEqual([
    `${SITE_PATH}:3 aria-pressed is inside a .map over an expression; only THEME_CHOICES (or a direct .filter of it) may be mapped here`,
  ])
})

test('a raw site mapping a call result or a double filter fails', () => {
  const call = THEME_IMPORT + MAPPED_PRESSED('build(THEME_CHOICES)')
  expect(callSiteOf(SITE_PATH, call)[0]).toContain('is inside a .map over build(…)')
  const twice = THEME_IMPORT + MAPPED_PRESSED('THEME_CHOICES.filter(a).filter(b)')
  expect(callSiteOf(SITE_PATH, twice)[0]).toContain('is inside a .map over')
})

test('a raw site mapping another fixedSets identifier than its registered set fails', () => {
  const source = "import { HOME_PERIODS } from '../../components/fixedSets'\n" + MAPPED_PRESSED('HOME_PERIODS')
  expect(callSiteOf(SITE_PATH, source)).toEqual([
    `${SITE_PATH}:3 aria-pressed is inside a .map over HOME_PERIODS, but this site is registered for THEME_CHOICES`,
  ])
})

test('a name imported from somewhere other than fixedSets fails', () => {
  const source = "import { THEME_CHOICES } from './elsewhere'\n" + MAPPED_PRESSED('THEME_CHOICES')
  expect(callSiteOf(SITE_PATH, source)[0]).toContain('which is not imported from components/fixedSets')
})

test('a marker in a raw site outside any .map fails', () => {
  expect(callSiteOf(SITE_PATH, THEME_IMPORT + '<button aria-pressed />')).toEqual([
    `${SITE_PATH}:2 aria-pressed is not inside a .map of THEME_CHOICES; a raw site draws its chips by mapping its fixed set`,
  ])
})

test('a marker inside a nested map is judged by the innermost map', () => {
  const source = THEME_IMPORT + '<div>{THEME_CHOICES.map((o) => <p>{rows.map((r) => <b aria-pressed />)}</p>)}</div>'
  expect(callSiteOf(SITE_PATH, source)).toEqual([
    `${SITE_PATH}:2 aria-pressed is inside a .map over rows, which is not imported from components/fixedSets`,
  ])
})

test('a registered raw site that is not among the sources fails closed', () => {
  expect(fixedSetCallSiteViolations([], [THEME_SITE])).toEqual([
    { path: SITE_PATH, line: 1, reason: `RAW_CHIP_SITES names ${SITE_PATH}, which is not among the product sources` },
  ])
})

test('a native select fails with its file:line, and a word starting with select does not', () => {
  const source = 'const a = 1\nreturn (\n  <select value={x}>\n    <option />\n  </select>\n)\n<selector />'
  expect(selectViolations([{ path: 'src/screens/Algo.tsx', source }])).toEqual([
    { path: 'src/screens/Algo.tsx', line: 3, reason: 'a native <select>; a choice over a set is made with the Selector' },
  ])
  expect(selectViolations([{ path: 'src/screens/Algo.tsx', source: '// <select> in a comment\n' }])).toEqual([])
})
