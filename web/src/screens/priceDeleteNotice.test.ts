/**
 * `varieties.md`, "Deleting an entry": the confirmation wording depends only on what
 * is chronologically earlier and later than the entry being deleted — never on
 * "today" — so it reads the same whichever entry (the one in force today included)
 * is picked.
 */

import { describe, expect, test } from 'vitest'
import { deleteNotice } from './priceDeleteNotice'

const E1 = { id: 1, effective_from: '2026-07-05', list_price: 9800, bulk_price: null, bulk_minimum: null }
const E2 = { id: 2, effective_from: '2026-09-01', list_price: 10500, bulk_price: null, bulk_minimum: null }
const E3 = { id: 3, effective_from: '2026-09-25', list_price: 11000, bulk_price: null, bulk_minimum: null }

describe('deleteNotice', () => {
  test('with an earlier entry, says the price that applies again and its date', () => {
    expect(deleteNotice([E3, E2, E1], 3)).toBe('Vuelve a regir $ 10.500 x g desde el 01/09')
  })

  test('for the first (oldest) entry, says there is no price before the next one', () => {
    expect(deleteNotice([E3, E2, E1], 1)).toBe('No va a haber precio antes del 01/09')
  })

  test('for the only entry, says the variety is left with no price', () => {
    expect(deleteNotice([E1], 1)).toBe('Sin precio: no se puede vender')
  })

  test('never mentions sales', () => {
    const notice = deleteNotice([E3, E2, E1], 3)
    expect(notice.toLowerCase()).not.toContain('venta')
  })
})
