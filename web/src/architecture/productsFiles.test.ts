/**
 * The Products layout pieces stay leaves: no value from `screens/Variedades` (a runtime cycle with
 * their parent) and no `api/*` module (the screen reads, they only draw). The checker on input it
 * must reject and input it must accept, then over the real named files.
 */

import { expect, test } from 'vitest'
import { PRODUCTS_FILES, findProductsFileImports } from './productsFiles'

const PATH = 'src/screens/varieties/SendCatalog.tsx'

function find(content: string, path = PATH): string[] {
  return findProductsFileImports([{ path, content }])
}

test('a value import from Variedades is found, in every spelling', () => {
  expect(find("import { VarietyRows } from '../Variedades'")).toEqual([
    `${PATH}:1: imports a value from screens/Variedades; only \`import type\` is allowed`,
  ])
  expect(find("import Variedades from '../Variedades'")).toHaveLength(1)
  expect(find("import { type Variety, NO_PRICE_TODAY } from '../Variedades'")).toHaveLength(1)
  expect(find("import { type Variety } from '../Variedades'")).toHaveLength(1)
  expect(find("import x from 'react'\nimport { y } from '../../screens/Variedades'")[0]).toContain(`${PATH}:2:`)
  expect(find("const m = await import('../Variedades')")).toHaveLength(1)
  expect(find("import '../Variedades'")).toHaveLength(1)
  expect(find("import {\n  VarietyRows,\n  type Variety,\n} from '../Variedades'")).toHaveLength(1)
})

test('a type import from Variedades is accepted', () => {
  expect(find("import type { Variety } from '../Variedades'")).toEqual([])
  expect(find("import type { Variety, TypePrice } from '../../screens/Variedades'")).toEqual([])
  expect(find("import type {\n  Variety,\n} from '../Variedades'")).toEqual([])
})

test('an api module import is found, whatever the form', () => {
  expect(find("import { readStock } from '../../api/stock'")).toEqual([`${PATH}:1: imports api/stock; the screen reads, this file only draws`])
  expect(find("import type { VarietyStock } from '../../api/stock'")).toHaveLength(1)
  expect(find("const m = await import('../../api/client')")).toHaveLength(1)
})

test('other imports, and other files under varieties, are accepted', () => {
  expect(find("import { VARIETIES_TEXT } from '../../copy/varieties'\nimport BotonLink from '../../components/BotonLink'")).toEqual([])
  expect(find("import { GENERIC_REFUSAL_MESSAGE } from '../Variedades'", 'src/screens/varieties/ThresholdForm.tsx')).toEqual([])
})

const modules = import.meta.glob(['/src/screens/varieties/*.tsx'], { query: '?raw', import: 'default', eager: true }) as Record<
  string,
  string
>

test('the named Products files exist and import neither a Variedades value nor an api module', () => {
  const files = Object.entries(modules).map(([path, content]) => ({ path: path.replace(/^\//, ''), content }))
  const paths = files.map(({ path }) => path)
  for (const named of PRODUCTS_FILES) expect(paths, named).toContain(named)
  expect(findProductsFileImports(files)).toEqual([])
})
