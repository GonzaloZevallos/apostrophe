/** `deleteRowIndices`: one "Delete payment" per later payment, whatever mix of
 * payment and credit rows it appears as. */

import { expect, test } from 'vitest'
import type { HowPaid, Standing } from '../../api/payments'
import type { AccountRow, Payment } from '../../api/payments'
import { deleteRowIndices, ledgerRowView } from './accountRows'

function payment(id: number): Payment {
  return { id, paid_on: '2026-10-05', amount: 8000, method: 'cash' }
}

function sale(id: number): AccountRow {
  return {
    kind: 'sale',
    date: '2026-10-01',
    running_balance: 5000,
    standing: 'owes',
    sale: { id, total: 5000, how_paid: 'owing' },
  }
}

function paymentRow(paymentId: number, saleId: number): AccountRow {
  return {
    kind: 'payment',
    date: '2026-10-05',
    running_balance: 0,
    standing: 'settled',
    payment: payment(paymentId),
    applied_to: { sale_id: saleId, sale_date: '2026-10-01', amount: 5000 },
  }
}

function creditRow(paymentId: number): AccountRow {
  return {
    kind: 'credit',
    date: '2026-10-05',
    running_balance: -3000,
    standing: 'credit',
    payment: payment(paymentId),
    amount: 3000,
  }
}

test('a payment that is only a credit row gets one index', () => {
  expect([...deleteRowIndices([creditRow(7)])]).toEqual([0])
})

test('a payment and its credit row give one index, the payment row\'s', () => {
  expect([...deleteRowIndices([sale(1), paymentRow(8, 1), creditRow(8)])]).toEqual([1])
})

test('two splits of one payment over two sales give one index', () => {
  expect([...deleteRowIndices([sale(1), sale(2), paymentRow(8, 1), paymentRow(8, 2)])]).toEqual([2])
})

test('sale rows never get an index', () => {
  expect(deleteRowIndices([sale(1), sale(2)]).size).toBe(0)
})

test('two different payments give two indices', () => {
  expect([...deleteRowIndices([sale(1), paymentRow(8, 1), creditRow(9)])]).toEqual([1, 2])
})

function saleWith(howPaid: HowPaid, standing: Standing, running: number): AccountRow {
  return {
    kind: 'sale',
    date: '2026-10-01',
    running_balance: running,
    standing,
    sale: { id: 1, total: 5000, how_paid: howPaid },
  }
}

const HOW_PAID_SUBS: readonly (readonly [HowPaid, string])[] = [
  ['cash', 'Paid in cash'],
  ['transfer', 'Paid by transfer'],
  ['owing', 'Left owing'],
  ['none', 'Nothing to pay'],
]

test.each(HOW_PAID_SUBS)('a %s sale reads "Sale" over %s, with its own total', (howPaid, sub) => {
  const view = ledgerRowView(saleWith(howPaid, 'settled', 0))
  expect(view.title).toBe('Sale')
  expect(view.sub).toBe(sub)
  expect(view.own).toBe('$ 5.000')
})

test('a sale names no variety and no grams', () => {
  const view = ledgerRowView(saleWith('cash', 'owes', 5000))
  expect(`${view.title} ${view.sub}`).not.toMatch(/\d+(,\d+)? g\b/)
})

test.each([
  ['owes', 6000, 'balance $ 6.000', 'debt'],
  ['settled', 0, 'balance $ 0', 'neutral'],
  ['credit', -2000, 'Credit $ 2.000', 'credit'],
] as const)('a %s standing gives the balance line and tone', (standing, running, balance, tone) => {
  for (const row of [
    { ...saleWith('owing', standing, running) },
    { ...paymentRow(8, 1), standing, running_balance: running },
    { ...creditRow(8), standing, running_balance: running },
  ]) {
    const view = ledgerRowView(row)
    expect(view.balance).toBe(balance)
    expect(view.balanceTone).toBe(tone)
  }
})

test('a payment row reads "Payment · method" over the sale it reached, with the amount applied', () => {
  const view = ledgerRowView(paymentRow(8, 1))
  expect(view.title).toBe('Payment · cash')
  expect(view.sub).toBe('On account of the sale of 01/10')
  expect(view.own).toBe('$ 5.000')
})

test('a transfer payment names transfer', () => {
  const row = paymentRow(8, 1)
  if (row.kind !== 'payment') throw new Error('expected a payment row')
  expect(ledgerRowView({ ...row, payment: { ...row.payment, method: 'transfer' } }).title).toBe('Payment · transfer')
})

test('a credit row reads "Payment · method" over "Credit", with the leftover amount without sign', () => {
  const view = ledgerRowView(creditRow(8))
  expect(view.title).toBe('Payment · cash')
  expect(view.sub).toBe('Credit')
  expect(view.own).toBe('$ 3.000')
})
