import { describe, expect, test } from 'vitest'
import type { Variety } from '../screens/Variedades'
import { pricedSaleOf } from './newSalePricing'
import { bodyLinesOf, saleBodyOf } from './saleBody'
import {
  draftLineOf,
  initialDraft,
  lineEditOf,
  saleDraftReducer,
  saleLineInputsOf,
  type DraftAction,
  type DraftState,
} from './saleDraft'

const FORMAT = { symbol: '$', decimals: 0 }

function draftOf(actions: DraftAction[]): DraftState {
  return actions.reduce(saleDraftReducer, initialDraft({ today: '2026-11-20' }))
}

function editAction(productId: number, quantityText: string, gift: boolean, specialText: string): DraftAction {
  const result = lineEditOf({ quantityText, gift, specialText }, FORMAT)
  if (!result.ok) throw new Error(`refused: ${result.refusal}`)
  const { quantityHundredths, specialPrice } = result.edit
  return { type: 'lineEdited', productId, quantityHundredths, gift, specialPrice }
}

describe('bodyLinesOf', () => {
  test('turns hundredths into the wire quantity, with the default line carrying no gift and no special price', () => {
    expect(bodyLinesOf([draftLineOf(10, 350), draftLineOf(11, 300)])).toEqual([
      { productId: 10, quantity: '3.5', gift: false, specialPrice: null },
      { productId: 11, quantity: '3', gift: false, specialPrice: null },
    ])
  })
})

const DRAFTS: [string, DraftAction[], { gift: boolean; specialPrice: number | null }[]][] = [
  ['plain lines', [{ type: 'productAdded', productId: 1 }, { type: 'productAdded', productId: 2 }], [
    { gift: false, specialPrice: null },
    { gift: false, specialPrice: null },
  ]],
  ['a Gift', [{ type: 'productAdded', productId: 1 }, { type: 'productAdded', productId: 2 }, editAction(2, '2', true, '')], [
    { gift: false, specialPrice: null },
    { gift: true, specialPrice: null },
  ]],
  ['a Special price', [{ type: 'productAdded', productId: 1 }, editAction(1, '3', false, '2.500')], [
    { gift: false, specialPrice: 2500 },
  ]],
  ['a Gift stepped up then down', [
    { type: 'productAdded', productId: 1 },
    editAction(1, '1', true, ''),
    { type: 'stepUp', productId: 1 },
    { type: 'stepDown', productId: 1 },
  ], [{ gift: true, specialPrice: null }]],
  ['a Special price stepped up and typed over', [
    { type: 'productAdded', productId: 1 },
    editAction(1, '1', false, '900'),
    { type: 'stepUp', productId: 1 },
    { type: 'quantityTyped', productId: 1, text: '4' },
  ], [{ gift: false, specialPrice: 900 }]],
]

describe('a draft built through the reducer', () => {
  test.each(DRAFTS)(
    '%s: bodyLinesOf, saleLineInputsOf and the body agree with the line on gift and specialPrice',
    (_name, actions, expected) => {
      const { lines } = draftOf(actions)
      const inputs = saleLineInputsOf(lines)
      const bodyLines = bodyLinesOf(lines)
      const body = saleBodyOf({
        date: '2026-11-20',
        customerId: null,
        shippingCharged: 0,
        note: '',
        payment: null,
        lines: bodyLines,
      })
      expect(lines).toHaveLength(expected.length)
      lines.forEach((line, index) => {
        const want = expected[index]
        expect({ gift: line.gift, specialPrice: line.specialPrice }).toEqual(want)
        expect(inputs[index]).toMatchObject(want ?? {})
        expect(bodyLines[index]).toMatchObject(want ?? {})
        expect(body.lines[index]).toMatchObject({ gift: line.gift, special_price: line.specialPrice })
      })
    },
  )

  test('one draft priced and sent: the priced line and the body line say the same', () => {
    const price = { id: 1, effective_from: '2026-09-01', list_price: 1000, bulk_price: null, bulk_minimum: null, vip_price: null }
    const products: Variety[] = [
      { id: 1, name: 'Rosa', archived: false, current_price: price },
      { id: 2, name: 'Árbol', archived: false, current_price: price },
      { id: 3, name: 'Lirio', archived: false, current_price: price },
    ]
    const { lines } = draftOf([
      { type: 'productAdded', productId: 1 },
      { type: 'productAdded', productId: 2 },
      editAction(2, '2', true, ''),
      { type: 'productAdded', productId: 3 },
      editAction(3, '1,5', false, '777'),
    ])
    const priced = pricedSaleOf({
      status: 'ready',
      products,
      settings: { bulk: false, vip: false },
      mostSoldIds: [],
      customerTypeId: null,
      lines,
      shipping: '0',
      format: FORMAT,
    })
    if (priced.kind !== 'priced') throw new Error('expected a priced sale')
    const body = saleBodyOf({
      date: '2026-11-20',
      customerId: null,
      shippingCharged: priced.sale.totals.shippingCharged,
      note: '',
      payment: null,
      lines: bodyLinesOf(lines),
    })
    expect(body.lines).toEqual([
      { product_id: 1, quantity: '1', gift: false, special_price: null },
      { product_id: 2, quantity: '2', gift: true, special_price: null },
      { product_id: 3, quantity: '1.5', gift: false, special_price: 777 },
    ])
    expect(priced.sale.lines.map((line) => [line.gift, line.pricing?.rule, line.pricing?.lineTotal])).toEqual([
      [false, 'list', 1000],
      [true, 'gift', 0],
      [false, 'special', 777],
    ])
  })
})

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
