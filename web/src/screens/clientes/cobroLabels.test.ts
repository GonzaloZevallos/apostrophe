import { describe, expect, test } from 'vitest'
import { ApiError, NetworkError } from '../../api/client'
import type { Customer } from '../../api/customers'
import { moneyFormatter } from '../../format/money'
import { openingAmount, previewFailure, previewIsCurrent, savePaymentLabel, validAmount } from './cobroLabels'

const customer = (standing: Customer['standing'], balance: number): Customer => ({
  id: 1,
  name: 'Ana',
  phone: null,
  phone_display: null,
  vip: false,
  customer_type_id: null,
  balance,
  owing_since: null,
  standing,
})

describe('openingAmount', () => {
  test('is the balance when the customer owes', () => {
    expect(openingAmount(customer('owes', 11000))).toBe(11000)
  })

  test('is null when the customer is settled', () => {
    expect(openingAmount(customer('settled', 0))).toBeNull()
  })

  test('is null when the customer is in credit', () => {
    expect(openingAmount(customer('credit', -500))).toBeNull()
  })
})

describe('previewIsCurrent', () => {
  const asked = { amount: 100, date: '2026-11-25' }

  test('is true for the same amount and date', () => {
    expect(previewIsCurrent(asked, { amount: 100, date: '2026-11-25' })).toBe(true)
  })

  test('is false for a different amount', () => {
    expect(previewIsCurrent(asked, { amount: 101, date: '2026-11-25' })).toBe(false)
  })

  test('is false for a different date', () => {
    expect(previewIsCurrent(asked, { amount: 100, date: '2026-11-24' })).toBe(false)
  })

  test('is false when either amount is null, even both', () => {
    expect(previewIsCurrent({ amount: null, date: '2026-11-25' }, { amount: null, date: '2026-11-25' })).toBe(false)
    expect(previewIsCurrent({ amount: null, date: '2026-11-25' }, { amount: 100, date: '2026-11-25' })).toBe(false)
    expect(previewIsCurrent(asked, { amount: null, date: '2026-11-25' })).toBe(false)
  })
})

describe('validAmount', () => {
  test('keeps an amount above zero that is a safe integer at the decimals', () => {
    expect(validAmount(5, 0)).toBe(5)
    expect(validAmount(12.5, 2)).toBe(12.5)
  })

  test('refuses null, zero, a negative amount and NaN', () => {
    for (const amount of [null, 0, -3, Number.NaN]) expect(validAmount(amount, 2)).toBeNull()
  })

  test('refuses an amount that is not a safe integer at the decimals', () => {
    expect(validAmount(Number.MAX_SAFE_INTEGER, 2)).toBeNull()
    expect(validAmount(Infinity, 0)).toBeNull()
  })
})

describe('savePaymentLabel', () => {
  const zero = moneyFormatter({ symbol: '$', decimals: 0 })
  const two = moneyFormatter({ symbol: '$', decimals: 2 })

  test('has no figure for null, zero, a negative amount or NaN', () => {
    for (const amount of [null, 0, -3, Number.NaN]) {
      expect(savePaymentLabel(amount, zero)).toBe('Save payment')
      expect(savePaymentLabel(amount, two)).toBe('Save payment')
    }
  })

  test('writes the amount through the money formatter at 0 decimals', () => {
    expect(savePaymentLabel(11000, zero)).toBe(`Save payment · ${zero.money(11000)}`)
  })

  test('writes the amount through the money formatter at 2 decimals', () => {
    expect(savePaymentLabel(12.5, two)).toBe(`Save payment · ${two.money(12.5)}`)
  })

  test('writes a nine-digit amount through the money formatter', () => {
    expect(savePaymentLabel(123456789, zero)).toBe(`Save payment · ${zero.money(123456789)}`)
    expect(savePaymentLabel(123456789, two)).toBe(`Save payment · ${two.money(123456789)}`)
  })
})

describe('previewFailure', () => {
  test('maps a NetworkError to offline', () => {
    expect(previewFailure(new NetworkError())).toBe('offline')
  })

  test('maps the above-balance refusal to above_balance', () => {
    expect(previewFailure(new ApiError(422, 'payment.above_balance'))).toBe('above_balance')
  })

  test('maps any other refusal or thrown value to other', () => {
    expect(previewFailure(new ApiError(500, 'server.error'))).toBe('other')
    expect(previewFailure(new Error('boom'))).toBe('other')
  })

  test('maps null and undefined to null', () => {
    expect(previewFailure(null)).toBeNull()
    expect(previewFailure(undefined)).toBeNull()
  })
})
