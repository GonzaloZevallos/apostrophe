import { describe, expect, test } from 'vitest'
import { saleBodyOf } from './saleBody'

const line = (productId: number, quantity: string, gift = false, specialPrice: number | null = null) => ({
  productId,
  quantity,
  gift,
  specialPrice,
})

const base = { date: '2026-11-20', customerId: 4, shippingCharged: 500, note: 'hello', payment: null, lines: [] }

describe('saleBodyOf', () => {
  test('maps every field to the wire keys, in order', () => {
    const body = saleBodyOf({
      ...base,
      payment: { kind: 'paid', payment_method_id: 2 },
      lines: [line(10, '3.5'), line(11, '0.05', true), line(12, '1', false, 900)],
    })
    expect(JSON.stringify(body)).toBe(
      '{"date":"2026-11-20","customer_id":4,"shipping_charged":500,"note":"hello",' +
        '"payment":{"kind":"paid","payment_method_id":2},"lines":[' +
        '{"product_id":10,"quantity":"3.5","gift":false,"special_price":null},' +
        '{"product_id":11,"quantity":"0.05","gift":true,"special_price":null},' +
        '{"product_id":12,"quantity":"1","gift":false,"special_price":900}]}',
    )
  })

  test('a note with text is sent as typed, spaces included', () => {
    expect(saleBodyOf({ ...base, note: '  hi ' }).note).toBe('  hi ')
  })

  test.each([['spaces only', '   '], ['empty', '']])('a %s note becomes null', (_label, note) => {
    expect(saleBodyOf({ ...base, note }).note).toBeNull()
  })

  test('an unset payment and a customer-less sale pass through as null', () => {
    const body = saleBodyOf({ ...base, customerId: null, payment: null })
    expect(JSON.stringify(body)).toBe(
      '{"date":"2026-11-20","customer_id":null,"shipping_charged":500,"note":"hello","payment":null,"lines":[]}',
    )
  })

  test('an owing payment is mapped as given', () => {
    expect(saleBodyOf({ ...base, payment: { kind: 'owing' } }).payment).toEqual({ kind: 'owing' })
  })
})
