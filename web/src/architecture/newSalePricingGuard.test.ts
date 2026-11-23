/**
 * The guard for New sale's one price result (`newSalePricingGuard.ts`). The first block feeds it
 * sources it must refuse and sources it must let through; the last reads the real `src/`.
 */

import { describe, expect, test } from 'vitest'
import { newSalePricingOffenders } from './newSalePricingGuard'

/** The cast, spelled from parts so the only file that contains the text is the module that may. */
const CAST = ['as', 'CompleteSale'].join(' ')

describe('what the guard refuses', () => {
  test('a cast to CompleteSale outside newSalePricing.ts', () => {
    expect(newSalePricingOffenders({ 'src/screens/X.tsx': `const s = x ${CAST}\n` })).toEqual([
      'src/screens/X.tsx: cast to CompleteSale',
    ])
  })

  test('a cast to CompleteSale in a test file', () => {
    expect(newSalePricingOffenders({ 'src/sales/a.test.ts': `const s = x ${CAST}\n` })).toEqual([
      'src/sales/a.test.ts: cast to CompleteSale',
    ])
  })

  test('priceSale imported under another name by a screen', () => {
    const source = "import { priceSale as p } from '../sales/pricing'\n"
    expect(newSalePricingOffenders({ 'src/screens/X.tsx': source })).toEqual(['src/screens/X.tsx: priceSale'])
  })
})

describe('what the guard lets through', () => {
  test('the names in a comment', () => {
    const source = `// ${CAST}\n/** priceSale */\nexport const A = 1\n`
    expect(newSalePricingOffenders({ 'src/screens/X.tsx': source })).toEqual([])
  })

  test('the cast and the call in newSalePricing.ts, and the definition in pricing.ts', () => {
    expect(
      newSalePricingOffenders({
        'src/sales/newSalePricing.ts': `const c = sale ${CAST}\nconst s = priceSale(x)\n`,
        'src/sales/pricing.ts': 'export function priceSale() {}\n',
      }),
    ).toEqual([])
  })

  test('a test file that names priceSale', () => {
    expect(newSalePricingOffenders({ 'src/sales/pricing.test.ts': 'priceSale(x)\n' })).toEqual([])
  })

  test('a file of src/architecture', () => {
    expect(newSalePricingOffenders({ 'src/architecture/g.ts': `x ${CAST}; priceSale\n` })).toEqual([])
  })
})

const modules = import.meta.glob(['/src/**/*.{ts,tsx}'], { query: '?raw', import: 'default', eager: true }) as Record<
  string,
  string
>

describe('the tree', () => {
  test('reads the pricing modules', () => {
    expect(Object.keys(modules)).toContain('/src/sales/newSalePricing.ts')
  })

  test('only newSalePricing.ts casts to CompleteSale, and only pricing.ts and newSalePricing.ts name priceSale', () => {
    expect(newSalePricingOffenders(modules)).toEqual([])
  })
})
