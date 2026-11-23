/** `deleteRowIndices` and `ledgerRowView`: one row per later payment, deletable once. */

import { expect, test } from 'vitest'
import type { HowPaid, Standing } from '../../api/payments'
import type { AccountRow, Payment } from '../../api/payments'
import { moneyFormatter } from '../../format/money'
import { deleteRowIndices, ledgerRowView as ledgerRowViewWith, rowKey } from './accountRows'

const MONEY = moneyFormatter({ symbol: '$', decimals: 0 })

function ledgerRowView(row: AccountRow) {
  return ledgerRowViewWith(row, MONEY)
}

function payment(id: number, amount = 8000): Payment {
  return { id, paid_on: '2026-10-05', amount, payment_method: { id: 1, name: 'Cash', icon: 'banknote' } }
}

function sale(id: number): AccountRow {
  return {
    kind: 'sale',
    date: '2026-10-01',
    running_balance: 5000,
    standing: 'owes',
    number: id,
    sale: { id, total: 5000, how_paid: 'owing', payment_method: null },
  }
}

function paymentRow(paymentId: number, standing: Standing = 'settled', running = 0, amount = 8000): AccountRow {
  return {
    kind: 'payment',
    date: '2026-10-05',
    running_balance: running,
    standing,
    is_partial: false,
    payment: payment(paymentId, amount),
  }
}

test('each payment row gets its own index, once', () => {
  expect([...deleteRowIndices([sale(1), sale(2), paymentRow(8), paymentRow(9)])]).toEqual([2, 3])
})

test('a lone payment row gets one index', () => {
  expect([...deleteRowIndices([paymentRow(7, 'credit', -3000)])]).toEqual([0])
})

test('sale rows never get an index', () => {
  expect(deleteRowIndices([sale(1), sale(2)]).size).toBe(0)
})

test('row keys come from the ids of each kind', () => {
  expect(rowKey(sale(4))).toBe('sale-4')
  expect(rowKey(paymentRow(8))).toBe('payment-8')
})

function saleWith(howPaid: HowPaid, standing: Standing, running: number, methodName = 'Cash'): AccountRow {
  return {
    kind: 'sale',
    date: '2026-10-01',
    running_balance: running,
    standing,
    number: 12,
    sale: {
      id: 1,
      total: 5000,
      how_paid: howPaid,
      payment_method: howPaid === 'paid' ? { id: 1, name: methodName, icon: 'banknote' } : null,
    },
  }
}

const HOW_PAID_SUBS: readonly (readonly [HowPaid, string])[] = [
  ['paid', 'Paid · Cash'],
  ['owing', 'Left owing'],
  ['none', 'Nothing to pay'],
]

test.each(HOW_PAID_SUBS)('a %s sale reads "Sale #N" over %s, with its own total', (howPaid, sub) => {
  const view = ledgerRowView(saleWith(howPaid, 'settled', 0))
  expect(view.title).toBe('Sale #12')
  expect(view.sub).toBe(sub)
  expect(view.own).toBe('$ 5.000')
})

test('a sale paid on the spot names its method as the account holds it now, after a rename', () => {
  expect(ledgerRowView(saleWith('paid', 'settled', 0, 'Mercado Pago')).sub).toBe('Paid · Mercado Pago')
  expect(ledgerRowView(saleWith('paid', 'settled', 0, 'Wire')).sub).toBe('Paid · Wire')
})

test('a sale with no method on file falls back to plain "Paid", never a cash or transfer word', () => {
  const row = saleWith('paid', 'settled', 0)
  if (row.kind !== 'sale') throw new Error('expected a sale row')
  const view = ledgerRowView({ ...row, sale: { ...row.sale, payment_method: null } })
  expect(view.sub).toBe('Paid')
})

test('a sale names no product and no grams', () => {
  const view = ledgerRowView(saleWith('paid', 'owes', 5000))
  expect(`${view.title} ${view.sub}`).not.toMatch(/\d+(,\d+)? g\b/)
})

test.each([
  ['owes', 6000, 'balance $ 6.000', 'debt'],
  ['settled', 0, 'balance $ 0', 'neutral'],
  ['credit', -2000, 'In your favor $ 2.000', 'credit'],
] as const)('a %s standing gives the balance line and tone', (standing, running, balance, tone) => {
  for (const row of [saleWith('owing', standing, running), paymentRow(8, standing, running)]) {
    const view = ledgerRowView(row)
    expect(view.balance).toBe(balance)
    expect(view.balanceTone).toBe(tone)
  }
})

test('the tone and the words follow the standing, not the sign of the running balance', () => {
  const view = ledgerRowView(paymentRow(8, 'settled', -2000))
  expect(view.balance).not.toContain('In your favor')
  expect(view.balanceTone).toBe('neutral')
})

test('a payment row reads "Payment · method" with its full amount and no sub-line', () => {
  const view = ledgerRowView(paymentRow(8, 'owes', 3000, 8000))
  expect(view.title).toBe('Payment · Cash')
  expect(view.sub).toBe('')
  expect(view.own).toBe('$ 8.000')
})

test('a transfer payment names transfer', () => {
  const row = paymentRow(8)
  if (row.kind !== 'payment') throw new Error('expected a payment row')
  expect(ledgerRowView({ ...row, payment: { ...row.payment, payment_method: { id: 2, name: 'Transfer', icon: 'bank' } } }).title).toBe('Payment · Transfer')
})

test('a payment row below zero says "In your favor $ X" with no sub-line', () => {
  const view = ledgerRowView(paymentRow(8, 'credit', -3000))
  expect(view.balance).toBe('In your favor $ 3.000')
  expect(view.balanceTone).toBe('credit')
  expect(view.sub).toBe('')
})
