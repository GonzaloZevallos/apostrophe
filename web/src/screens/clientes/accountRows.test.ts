/** `deleteRowIndices`: one "Delete payment" per later payment, whatever mix of
 * payment and credit rows it appears as. */

import { expect, test } from 'vitest'
import type { AccountRow, Payment } from '../../api/payments'
import { deleteRowIndices } from './accountRows'

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
