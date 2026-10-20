/** `spanishProblems` on fixtures: each way Spanish survives in a section is refused, and
 * English and a same-in-both word pass. No section can opt out. */

import { describe, expect, test } from 'vitest'
import { fold, spanishMarker, spanishProblems, type Section } from './copySpanish'

describe('a section', () => {
  test('refuses a renamed key that keeps a baseline text', () => {
    // 'Precio guardado' is a baseline text no marker catches: only the baseline does.
    const section: Section = { PRICE_SAVED_TOAST: 'Precio guardado' }
    expect(spanishProblems('copy/sales.ts', section)).toEqual([
      'copy/sales.ts: PRICE_SAVED_TOAST equals a Spanish text of the baseline and is not in SAME_IN_BOTH',
    ])
  })

  test('refuses a renamed key that keeps "Guardar", by its marker', () => {
    expect(spanishProblems('copy/sales.ts', { SAVE_SALE_BUTTON: 'Guardar' })).toEqual([
      'copy/sales.ts: SAVE_SALE_BUTTON trips the Spanish marker "guardar"',
    ])
  })

  test('refuses a function entry that renders a baseline text', () => {
    const section: Section = { dueLine: (date: string) => `Te debe desde el ${date}` }
    const baseline = new Set([fold('Te debe desde el 28/09')])
    expect(spanishProblems('copy/customers.ts', section, baseline)).toContain(
      'copy/customers.ts: dueLine equals a Spanish text of the baseline and is not in SAME_IN_BOTH',
    )
  })

  test('refuses a function entry whose Spanish shows only for one flag', () => {
    const section: Section = { line: (isNew: boolean) => (isNew ? 'A new one' : 'Una nueva') }
    expect(spanishProblems('copy/auth.ts', section)).toEqual(['copy/auth.ts: line trips the Spanish marker "una"'])
  })

  test('refuses an accented new string, in a nested object too', () => {
    const section: Section = { REASONS: { gone: 'Esta ya no está' }, plain: 'Sesión' }
    expect(spanishProblems('copy/states.ts', section)).toEqual(
      expect.arrayContaining([
        'copy/states.ts: REASONS trips the Spanish marker "á"',
        'copy/states.ts: plain trips the Spanish marker "ó"',
      ]),
    )
  })

  test('passes English, whatever the function takes', () => {
    const section: Section = {
      TITLE: 'Save sale',
      owes: (name: string, amount: string, count: number) => `${name} owes you ${amount} for ${count} sales`,
      NESTED: { a: 'Nobody owes you' },
    }
    expect(spanishProblems('copy/sales.ts', section)).toEqual([])
  })

  test('passes a same-in-both value that carries a reason, and refuses one without', () => {
    const baseline = new Set(['total'])
    const ok: Section = { TOTAL_LABEL: 'Total', SAME_IN_BOTH: [{ value: 'Total', reason: 'the same word in both languages' }] }
    expect(spanishProblems('copy/sales.ts', ok, baseline)).toEqual([])
    const noReason: Section = { TOTAL_LABEL: 'Total', SAME_IN_BOTH: [{ value: 'Total', reason: ' ' }] }
    expect(spanishProblems('copy/sales.ts', noReason, baseline)).toEqual([
      'copy/sales.ts: SAME_IN_BOTH lists a value with no reason',
    ])
  })

  test('refuses a SAME_IN_BOTH entry the section does not show or the baseline does not hold', () => {
    const unused: Section = { OTHER: 'Hello', SAME_IN_BOTH: [{ value: 'Total', reason: 'same word' }] }
    expect(spanishProblems('copy/a.ts', unused, new Set(['total']))).toEqual([
      'copy/a.ts: SAME_IN_BOTH lists a value the section does not show',
    ])
    const notBaseline: Section = { LABEL: 'Hello', SAME_IN_BOTH: [{ value: 'Hello', reason: 'same word' }] }
    expect(spanishProblems('copy/a.ts', notBaseline, new Set())).toEqual([
      'copy/a.ts: SAME_IN_BOTH lists a value that is not in the Spanish baseline',
    ])
  })

  test('does not read LIMITED_COPY or LONG_REFUSALS, which only repeat exported texts', () => {
    const section: Section = { LIMITED_COPY: [{ kind: 'help', text: 'Una ayuda' }], LONG_REFUSALS: ['Una ayuda'] }
    expect(spanishProblems('copy/a.ts', section)).toEqual([])
  })
})

describe('a section cannot opt out', () => {
  test('a leftover PENDING export does not skip it', () => {
    expect(spanishProblems('copy/sales.ts', { PENDING: true, SAVE: 'Guardar' })).toEqual([
      'copy/sales.ts: SAVE trips the Spanish marker "guardar"',
    ])
  })
})

describe('spanishMarker', () => {
  test.each([
    ['Cargá', 'á'],
    ['¿Seguro?', '¿'],
    ['Delete the sale para siempre', 'para'],
    ['SIN stock', 'sin'],
  ])('%s trips %s', (text, marker) => {
    expect(spanishMarker(text)).toBe(marker)
  })

  test.each(['Save sale', '$ 999.999 · 28/09', 'Nobody owes you', 'Shipping and travel'])('%s passes', (text) => {
    expect(spanishMarker(text)).toBeNull()
  })
})
