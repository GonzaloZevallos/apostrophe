/**
 * Migration lock for the old whole-peso writers: only the files below may still import
 * `formatMoney`, `formatSignedMoney` or `formatMoneyMagnitude` (they move to `useMoney()` and the
 * list shrinks to nothing, when the writers and this test are deleted). A new importer fails, and
 * so does a listed file that no longer imports them, so the list can only get shorter.
 */

import { describe, expect, test } from 'vitest'
import { legacyImports } from './legacyFormatMoney'

const STILL_IMPORTING: readonly string[] = [
  'src/screens/Analisis.tsx',
  'src/screens/AnalisisTablas.tsx',
  'src/screens/EntriesList.tsx',
  'src/screens/Gastos.tsx',
  'src/screens/StockEntryForm.tsx',
  'src/screens/Variedades.tsx',
  'src/screens/analisisCards.ts',
  'src/screens/analisisCost.ts',
  'src/screens/expenses/MonthBody.tsx',
  'src/screens/onboarding/VarietyDone.tsx',
  'src/screens/priceDeleteNotice.ts',
  'src/screens/varieties/PriceRows.tsx',
  'src/screens/varieties/VarietyPage.tsx',
  'src/screens/varieties/VarietyStockSection.tsx',
]

const modules = import.meta.glob('/src/**/*.{ts,tsx}', { query: '?raw', import: 'default', eager: true }) as Record<
  string,
  string
>

function importers(): string[] {
  return Object.entries(modules)
    .filter(([path]) => !/\.test\.tsx?$/.test(path) && !path.endsWith('/format/money.ts'))
    .filter(([path, source]) => legacyImports(path, source).length > 0)
    .map(([path]) => path.replace(/^\//, ''))
    .sort()
}

describe('the importers of the old money writers', () => {
  test('no new file imports them', () => {
    const listed = new Set(STILL_IMPORTING)
    expect(importers().filter((path) => !listed.has(path))).toEqual([])
  })

  test('a listed file that no longer imports them leaves the list', () => {
    const now = new Set(importers())
    expect(STILL_IMPORTING.filter((path) => !now.has(path))).toEqual([])
  })

  test('the reader names what a source imports from the money module, and nothing else', () => {
    const source = "import { formatGrams, formatMoney as fm, formatSignedMoney } from '../../format/money'\nimport { formatMoney } from './other'\n"
    expect(legacyImports('src/screens/X.tsx', source)).toEqual(['formatMoney', 'formatSignedMoney'])
    expect(legacyImports('src/screens/Y.ts', "import { formatGrams } from '../format/money'\n")).toEqual([])
    expect(legacyImports('src/screens/Z.ts', "import { formatMoney } from '../format/dates'\n")).toEqual([])
  })
})
