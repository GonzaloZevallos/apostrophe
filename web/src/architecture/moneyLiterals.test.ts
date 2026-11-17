/**
 * The literal guard for money text (`moneyLiterals.ts`): no module of `copy/` and not `format/money.ts`
 * spells a currency symbol and a digit, `SALE_BILL_TEXT` and the sample-argument files aside.
 * The first blocks feed the guard sources it must refuse; the last reads the real tree.
 */

import { describe, expect, test } from 'vitest'
import { moneyLiteralHits } from './moneyLiterals'

const COPY = 'src/copy/sales.ts'

describe('what the guard refuses', () => {
  test('a symbol and a digit in a copy string, spaced or attached', () => {
    expect(moneyLiteralHits(COPY, "export const A = 'Pay $ 5 now'\n")).toEqual(['Pay $ 5 now'])
    expect(moneyLiteralHits(COPY, "export const A = 'Over $0'\n")).toEqual(['Over $0'])
    expect(moneyLiteralHits(COPY, "export const A = 'Max €12'\n")).toEqual(['Max €12'])
  })

  test('a symbol and a digit in the text around the placeholders of a template', () => {
    expect(moneyLiteralHits(COPY, 'export const A = (x: string) => `${x} costs $ 0 here`\n')).toEqual([' costs $ 0 here'])
  })

  test('a symbol and a digit in the money module', () => {
    expect(moneyLiteralHits('src/format/money.ts', "const ZERO = '$ 0'\n")).toEqual(['$ 0'])
  })

  test('a path with a folder above src', () => {
    expect(moneyLiteralHits('/repo/web/src/copy/stock.ts', "export const A = 'It has $5'\n")).toEqual(['It has $5'])
  })
})

describe('what the guard lets through', () => {
  test('a placeholder, a symbol with no digit and a comment that shows a format', () => {
    const source = [
      '/** `$ 11.000` is what the app writes. */',
      'export const A = (amount: string) => `Total ${amount}`',
      "export const B = 'Price in $ or euros'",
      '',
    ].join('\n')
    expect(moneyLiteralHits(COPY, source)).toEqual([])
  })

  test('the Sale bill keeps its fixed form, and nothing else in the file does', () => {
    const source = "export const SALE_BILL_TEXT = { gift: () => 'Gift · $ 0' }\nexport const OTHER = 'Over $0'\n"
    expect(moneyLiteralHits(COPY, source)).toEqual(['Over $0'])
  })

  test('a file the guard does not read', () => {
    expect(moneyLiteralHits('src/sales/saleBill.ts', "const FIXED = '$ 11.000'\n")).toEqual([])
    expect(moneyLiteralHits('src/copy/sales.test.ts', "const SEEN = '$ 11.000'\n")).toEqual([])
    expect(moneyLiteralHits('src/copy/limits.ts', "const AMOUNT = '$ 999.999'\n")).toEqual([])
  })
})

const modules = import.meta.glob(['/src/format/money.ts', '/src/copy/**/*.{ts,tsx}'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

describe('the tree', () => {
  test('reads the money module and the copy modules', () => {
    const paths = Object.keys(modules)
    expect(paths).toContain('/src/format/money.ts')
    expect(paths).toContain('/src/copy/sales.ts')
  })

  test('no copy string and no string of the money module spells a currency symbol and a digit', () => {
    const offences = Object.entries(modules).flatMap(([path, source]) =>
      moneyLiteralHits(path.replace(/^\//, ''), source).map((text) => `${path}: ${text}`),
    )
    expect(offences).toEqual([])
  })
})
