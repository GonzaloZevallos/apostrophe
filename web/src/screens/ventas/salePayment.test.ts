/**
 * `paymentText` in `salePayment.ts`: the one builder of the sentence, with the method of payment
 * read only for the paid variant. A plain `t` stub echoes the key and its arguments.
 */

import type { TFunction } from 'i18next'
import { describe, expect, test } from 'vitest'
import { paymentText } from './salePayment'
import type { PaymentView } from './salePayment'

const t = ((key: string, args?: Record<string, unknown>) =>
  args === undefined ? key : `${key} ${JSON.stringify(args)}`) as unknown as TFunction

const PAID: PaymentView = { variant: 'paid', amount: null }

describe('the method', () => {
  test('paid with a method reads the paid-with sentence with the method trimmed', () => {
    expect(paymentText(t, PAID, '  Cash ')).toBe('sales:card.payment.paidWith {"method":"Cash"}')
  })

  test.each([
    ['null', null],
    ['undefined', undefined],
    ['empty', ''],
    ['blank', '  '],
  ])('paid with a %s method reads the plain paid sentence', (_name, method) => {
    expect(paymentText(t, PAID, method)).toBe('sales:card.payment.paid')
  })

  test.each([
    ['unpaid', { variant: 'unpaid', amount: null }, 'sales:card.payment.unpaid'],
    ['part_paid', { variant: 'part_paid', amount: '$ 4.000' }, 'sales:card.payment.partPaid {"amount":"$ 4.000"}'],
    ['unknown', { variant: 'unknown', amount: null }, 'sales:card.payment.unknown'],
  ] as const)('%s ignores a method', (_name, view, expected) => {
    expect(paymentText(t, view, 'Cash')).toBe(expected)
  })
})
