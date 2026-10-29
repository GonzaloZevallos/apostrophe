import { describe, expect, test } from 'vitest'
import { SALE_BILL_TEXT } from '../copy/sales'
import type { SaleBill, SaleBillLine } from '../api/sales'
import cases from './saleBill.cases.json'
import { renderSaleBill } from './saleBill'

interface Case {
  name: string
  bill: SaleBill
  expected: string
}

const REFERENCE = cases as Case[]

describe('renderSaleBill against the hand-written reference set', () => {
  test.each(REFERENCE.map((c) => [c.name, c] as const))('%s', (_name, c) => {
    expect(renderSaleBill(c.bill)).toBe(c.expected)
  })
})

const bulkBill: SaleBill = {
  business_name: 'Flores Test',
  date: '2026-09-18',
  shipping_charged: 0,
  total: 31500,
  lines: [{ product: 'Luna', quantity: 3.5, amount: 31500, rule: 'bulk', unit_price: 9000 }],
  payment: { state: 'cash', still_owed: null },
  balance: null,
}

describe('the unit comes from the one copy entry', () => {
  test('with the unit overridden to "u" a bulk line reads "3,5 u" and "/u"', () => {
    const text = renderSaleBill(bulkBill, { ...SALE_BILL_TEXT, unit: 'u' })
    expect(text).toContain('Luna 3,5 u · bulk price $ 9.000/u · $ 31.500')
    expect(text).not.toMatch(/\bg\b/)
  })
})

describe('what the text never holds', () => {
  const leakBill: SaleBill = {
    ...bulkBill,
    shipping_charged: 1500,
    total: 54000,
    lines: [
      bulkBill.lines[0] as SaleBillLine,
      { product: 'Aurora', quantity: 2, amount: 18000, rule: null, unit_price: null },
      { product: 'Mora', quantity: 1, amount: 0, rule: 'gift', unit_price: null },
    ],
    payment: { state: 'owed', still_owed: 4000 },
    balance: -2500,
  }

  test.each([
    ['a plain bill', bulkBill],
    ['a bill with every line kind', leakBill],
  ])('%s has no markdown mark, link or internal word', (_name, bill) => {
    const text = renderSaleBill(bill)
    expect(text).not.toMatch(/[*_`]/)
    expect(text.toLowerCase()).not.toMatch(/http|vip|special|list|note|\bid\b/)
  })

  test('the text holds none of the planted note, customer name or ids', () => {
    const planted = {
      ...leakBill,
      note: 'NOTE-PLANTED',
      customer_name: 'Customer Planted',
      id: 987654,
      customer_id: 424242,
    } as SaleBill
    const text = renderSaleBill(planted)
    for (const secret of ['NOTE-PLANTED', 'Customer Planted', '987654', '424242']) {
      expect(text).not.toContain(secret)
    }
  })
})
