/**
 * Guard: a message shared by several screens has one source. "Revisá los gramos cargados"
 * lives only in `stockMessages.ts` and "Precio guardado" only in `varieties/priceMessages.ts`;
 * no other screen file (tests aside) spells either literal.
 */

import { expect, test } from 'vitest'

const GRAMS_INVALID = 'Revisá los gramos cargados'
const PRICE_SAVED = 'Precio guardado'

const raw = import.meta.glob(['/src/screens/**/*.{ts,tsx}', '!/src/screens/**/*.test.{ts,tsx}'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

function filesSpelling(sources: Record<string, string>, literal: string, owner: string): string[] {
  return Object.entries(sources)
    .filter(([path, content]) => path !== owner && content.includes(literal))
    .map(([path]) => path)
    .sort()
}

test('the screens glob reads the real sources', () => {
  expect(Object.keys(raw)).toContain('/src/screens/stockMessages.ts')
  expect(Object.keys(raw)).toContain('/src/screens/varieties/priceMessages.ts')
  expect(Object.keys(raw).some((path) => path.endsWith('.test.tsx'))).toBe(false)
})

test('the grams refusal is defined only in stockMessages.ts', () => {
  expect(raw['/src/screens/stockMessages.ts']).toContain(GRAMS_INVALID)
  expect(filesSpelling(raw, GRAMS_INVALID, '/src/screens/stockMessages.ts')).toEqual([])
})

test('"Precio guardado" is defined only in priceMessages.ts', () => {
  expect(raw['/src/screens/varieties/priceMessages.ts']).toContain(PRICE_SAVED)
  expect(filesSpelling(raw, PRICE_SAVED, '/src/screens/varieties/priceMessages.ts')).toEqual([])
})

test('the check names a file that spells a literal outside its owner', () => {
  const sources = {
    '/src/screens/stockMessages.ts': `export const A = '${GRAMS_INVALID}'`,
    '/src/screens/varieties/PriceForm.tsx': `onDone('${PRICE_SAVED}')`,
    '/src/screens/Other.tsx': `const x = '${GRAMS_INVALID}'`,
  }
  expect(filesSpelling(sources, GRAMS_INVALID, '/src/screens/stockMessages.ts')).toEqual(['/src/screens/Other.tsx'])
  expect(filesSpelling(sources, PRICE_SAVED, '/src/screens/varieties/priceMessages.ts')).toEqual([
    '/src/screens/varieties/PriceForm.tsx',
  ])
})
