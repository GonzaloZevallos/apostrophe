/**
 * Test-only: a typed `Sale` whose `payment_state` and `still_owed` are set as a pair, the way the
 * API answers them (paid: 0, unpaid: the whole total, part_paid: a positive amount under the
 * total, unknown: both null). Imports types only; no test library.
 */

import type { Sale } from '../../api/sales'

const TOTAL = 11000
const PART_OWED = 4000

const STILL_OWED: Record<NonNullable<Sale['payment_state']>, number> = {
  paid: 0,
  unpaid: TOTAL,
  part_paid: PART_OWED,
}

export function saleWith(state: Sale['payment_state'], overrides: Partial<Sale> = {}): Sale {
  const base: Sale = {
    id: 10,
    number: 2,
    date: '2026-09-14',
    customer: { id: 1, name: 'Ana Pérez', vip: false },
    shipping_charged: 500,
    note: null,
    payment: state === 'paid' ? 'paid' : 'owing',
    total: TOTAL,
    lines: [],
    still_owing: state === 'unpaid' || state === 'part_paid',
    payment_state: state,
    still_owed: state === null ? null : STILL_OWED[state],
  }
  return { ...base, ...overrides }
}
