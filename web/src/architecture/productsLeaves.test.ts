/**
 * The two Products leaf scans, on input they must reject and input they must accept, then over
 * the real `src/` and `front-exclude.json`.
 */

import { expect, test } from 'vitest'
import { findComputerSegmentImports, findStaleExclusions } from './productsLeaves'

const ENTRY = 'src/screens/varieties/ProductsComputer.tsx'

test('a segment import in a file the computer layout reaches is found, however deep', () => {
  const files = [
    { path: ENTRY, content: "import Body from './ProductsBody'" },
    { path: 'src/screens/varieties/ProductsBody.tsx', content: "import { x } from '../../components/deep'" },
    { path: 'src/components/deep.ts', content: "import { readSegment } from '../screens/varieties/productsSegment'" },
    { path: 'src/screens/varieties/productsSegment.ts', content: 'export const readSegment = 1' },
  ]
  expect(findComputerSegmentImports(files)).toEqual([
    `src/components/deep.ts: imports productsSegment, reached from ${ENTRY}; only ProductsPhone reads the segment`,
  ])
})

test('the phone importing the segment, and a cycle among computer files, are accepted', () => {
  const files = [
    { path: ENTRY, content: "import A from './A'" },
    { path: 'src/screens/varieties/A.tsx', content: "import C from './ProductsComputer'" },
    { path: 'src/screens/varieties/ProductsPhone.tsx', content: "import { readSegment } from './productsSegment'" },
    { path: 'src/screens/varieties/productsSegment.ts', content: 'export const readSegment = 1' },
  ]
  expect(findComputerSegmentImports(files)).toEqual([])
})

test('an `import type` edge into the dispatcher is no edge, and the same import as a value is found', () => {
  const dispatcher = { path: 'src/screens/Variedades.tsx', content: "import Phone from './varieties/ProductsPhone'" }
  const phone = { path: 'src/screens/varieties/ProductsPhone.tsx', content: "import { readSegment } from './productsSegment'" }
  const segment = { path: 'src/screens/varieties/productsSegment.ts', content: 'export const readSegment = 1' }
  const body = (content: string) => ({ path: 'src/screens/varieties/ProductsBody.tsx', content })
  const entry = { path: ENTRY, content: "import Body from './ProductsBody'" }
  expect(findComputerSegmentImports([entry, body("import type { Variety } from '../Variedades'"), dispatcher, phone, segment])).toEqual([])
  expect(findComputerSegmentImports([entry, body("import { Variety } from '../Variedades'"), dispatcher, phone, segment])).toEqual([
    `src/screens/varieties/ProductsPhone.tsx: imports productsSegment, reached from ${ENTRY}; only ProductsPhone reads the segment`,
  ])
})

const LEAF = 'src/screens/varieties/ProductsPhoneBodies.tsx'
const PATTERN = '^src/screens/varieties/ProductsPhoneBodies\\.tsx$'

test('an exclusion whose module a screen now imports, or that matches no file, is found', () => {
  const wired = [
    { path: LEAF, content: 'export const a = 1' },
    { path: 'src/screens/varieties/ProductsPhone.tsx', content: "import { a } from './ProductsPhoneBodies'" },
  ]
  expect(findStaleExclusions(wired, [PATTERN])).toEqual([
    `${PATTERN}: ${LEAF} is imported by src/screens/varieties/ProductsPhone.tsx; remove the entry`,
  ])
  expect(findStaleExclusions([], [PATTERN])).toEqual([`${PATTERN}: matches no file; remove the entry`])
})

test('an exclusion only tests and excluded files use, and one outside varieties, are accepted', () => {
  const files = [
    { path: LEAF, content: 'export const a = 1' },
    { path: 'src/screens/varieties/ProductsPhoneBodies.test.tsx', content: "import { a } from './ProductsPhoneBodies'" },
  ]
  expect(findStaleExclusions(files, [PATTERN, '\\.test\\.tsx?$'])).toEqual([])
  expect(findStaleExclusions([], ['^src/test/'])).toEqual([])
})

const modules = import.meta.glob(['/src/**/*.{ts,tsx}'], { query: '?raw', import: 'default', eager: true }) as Record<string, string>
const exclusions = import.meta.glob('/scripts/docs/front-exclude.json', { query: '?raw', import: 'default', eager: true }) as Record<
  string,
  string
>
const sources = Object.entries(modules).map(([path, content]) => ({ path: path.replace(/^\//, ''), content }))

test('nothing the computer layout reaches imports productsSegment', () => {
  expect(findComputerSegmentImports(sources)).toEqual([])
})

test('every front-exclude entry for a varieties module is still needed', () => {
  const patterns = JSON.parse(Object.values(exclusions)[0] ?? '[]') as string[]
  expect(patterns.length).toBeGreaterThan(0)
  expect(findStaleExclusions(sources, patterns)).toEqual([])
})
