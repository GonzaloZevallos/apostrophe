import { describe, expect, test } from 'vitest'
import {
  MAX_QUANTITY_HUNDREDTHS,
  draftLineOf,
  effectiveChoice,
  initialDraft,
  isDirty,
  isQuantityHundredths,
  isSpecialPrice,
  lineBufferOf,
  lineBufferWith,
  lineEditChanged,
  lineEditOf,
  saleDraftReducer,
  saleLineInputsOf,
  typedQuantity,
  type DraftAction,
  type DraftState,
} from './saleDraft'

const TODAY = '2026-11-19'
const FORMAT = { symbol: '$', decimals: 0 }
const FORMAT_CENTS = { symbol: '$', decimals: 2 }

function run(actions: DraftAction[], from: DraftState = initialDraft({ today: TODAY })): DraftState {
  return actions.reduce(saleDraftReducer, from)
}

describe('saleLineInputsOf', () => {
  test('maps each line to a priced-sale input: a string id, the quantity, and the line gift and special price', () => {
    expect(saleLineInputsOf([draftLineOf(7, 250)])).toEqual([
      { id: '7', productId: 7, gramsHundredths: 250, gift: false, specialPrice: null },
    ])
    expect(
      saleLineInputsOf([
        { ...draftLineOf(8, 100), gift: true },
        { ...draftLineOf(9, 300), specialPrice: 5000 },
      ]),
    ).toEqual([
      { id: '8', productId: 8, gramsHundredths: 100, gift: true, specialPrice: null },
      { id: '9', productId: 9, gramsHundredths: 300, gift: false, specialPrice: 5000 },
    ])
    expect(saleLineInputsOf([])).toEqual([])
  })

  test('after taps, one input per line with a unique id and the tapped quantity', () => {
    const state = run([
      { type: 'productAdded', productId: 3 },
      { type: 'stepUp', productId: 3 },
      { type: 'stepUp', productId: 3 },
      { type: 'productAdded', productId: 9 },
    ])
    const inputs = saleLineInputsOf(state.lines)
    expect(inputs.map((input) => input.gramsHundredths)).toEqual([300, 100])
    expect(inputs.map((input) => input.productId)).toEqual([3, 9])
    expect(new Set(inputs.map((input) => input.id)).size).toBe(2)
  })
})

describe('opening', () => {
  test('starts empty, unset, dated today, with no customer unless one is passed', () => {
    expect(initialDraft({ today: TODAY })).toEqual({
      customerId: null,
      lines: [],
      date: TODAY,
      openedOn: TODAY,
      shipping: '',
      note: '',
      proposedMethodId: null,
      choice: { kind: 'unset' },
    })
    expect(initialDraft({ today: TODAY, customerId: 7 }).customerId).toBe(7)
  })
})

describe('lines', () => {
  test('adding a product opens a line at one whole unit', () => {
    expect(run([{ type: 'productAdded', productId: 3 }]).lines).toEqual([
      { productId: 3, quantityHundredths: 100, gift: false, specialPrice: null },
    ])
  })

  test('adding a product already in the sale raises its line and never makes a second', () => {
    const state = run([
      { type: 'productAdded', productId: 3 },
      { type: 'productAdded', productId: 4 },
      { type: 'productAdded', productId: 3 },
    ])
    expect(state.lines).toEqual([
      draftLineOf(3, 200),
      draftLineOf(4, 100),
    ])
  })

  test('stepUp adds one whole unit to that line only', () => {
    const state = run([
      { type: 'productAdded', productId: 3 },
      { type: 'productAdded', productId: 4 },
      { type: 'stepUp', productId: 4 },
    ])
    expect(state.lines.map((line) => line.quantityHundredths)).toEqual([100, 200])
  })

  test('stepDown judges the current quantity: 150 gives 50, which stays, and a later stepDown removes it', () => {
    const at150 = run([
      { type: 'productAdded', productId: 3 },
      { type: 'quantityTyped', productId: 3, text: '1,5' },
    ])
    expect(at150.lines).toEqual([draftLineOf(3, 150)])
    const at50 = saleDraftReducer(at150, { type: 'stepDown', productId: 3 })
    expect(at50.lines).toEqual([draftLineOf(3, 50)])
    expect(saleDraftReducer(at50, { type: 'stepDown', productId: 3 }).lines).toEqual([])
  })

  test('stepDown from exactly one whole unit removes the line, and from 200 gives 100', () => {
    const one = run([{ type: 'productAdded', productId: 3 }])
    expect(saleDraftReducer(one, { type: 'stepDown', productId: 3 }).lines).toEqual([])
    const two = saleDraftReducer(one, { type: 'stepUp', productId: 3 })
    expect(saleDraftReducer(two, { type: 'stepDown', productId: 3 }).lines).toEqual([draftLineOf(3, 100)])
  })

  test('a typed quantity replaces the line quantity', () => {
    const state = run([
      { type: 'productAdded', productId: 3 },
      { type: 'quantityTyped', productId: 3, text: '2.25' },
    ])
    expect(state.lines).toEqual([draftLineOf(3, 225)])
  })

  test('a refused typed quantity leaves the state unchanged and never removes the line', () => {
    const base = run([
      { type: 'productAdded', productId: 3 },
      { type: 'quantityTyped', productId: 3, text: '4' },
    ])
    for (const text of ['0', '', 'abc', '1.234', '10000000000000']) {
      expect(saleDraftReducer(base, { type: 'quantityTyped', productId: 3, text })).toBe(base)
    }
  })

  test('a typed quantity for a product not in the sale changes nothing', () => {
    const base = run([{ type: 'productAdded', productId: 3 }])
    expect(saleDraftReducer(base, { type: 'quantityTyped', productId: 9, text: '2' })).toEqual(base)
  })

  test('stepUp and productAdded leave the state unchanged past the bound', () => {
    const base = run([
      { type: 'productAdded', productId: 3 },
      { type: 'quantityTyped', productId: 3, text: '9999999999999.49' },
    ])
    expect(base.lines[0]?.quantityHundredths).toBe(MAX_QUANTITY_HUNDREDTHS - 50)
    expect(saleDraftReducer(base, { type: 'stepUp', productId: 3 })).toBe(base)
    expect(saleDraftReducer(base, { type: 'productAdded', productId: 3 })).toBe(base)
  })

  test('stepUp up to exactly the bound is allowed', () => {
    const base = run([
      { type: 'productAdded', productId: 3 },
      { type: 'quantityTyped', productId: 3, text: '9999999999998.99' },
    ])
    expect(saleDraftReducer(base, { type: 'stepUp', productId: 3 }).lines[0]?.quantityHundredths).toBe(
      MAX_QUANTITY_HUNDREDTHS,
    )
  })

  test('isDirty is true only with at least one line, whatever else is filled in', () => {
    const empty = run([
      { type: 'customerChosen', customerId: 5 },
      { type: 'shippingSet', text: '10' },
      { type: 'noteSet', text: 'hi' },
      { type: 'dateSet', date: '2026-11-01', today: TODAY },
      { type: 'choiceSet', choice: { kind: 'owing' } },
    ])
    expect(isDirty(empty)).toBe(false)
    const withLine = saleDraftReducer(empty, { type: 'productAdded', productId: 1 })
    expect(isDirty(withLine)).toBe(true)
    expect(isDirty(saleDraftReducer(withLine, { type: 'stepDown', productId: 1 }))).toBe(false)
  })
})

describe('Gift and Special price on a line', () => {
  const special = { ...draftLineOf(3, 300), specialPrice: 5000 }
  const withSpecial = (): DraftState => ({ ...initialDraft({ today: TODAY }), lines: [special] })
  const withGift = (): DraftState => ({
    ...initialDraft({ today: TODAY }),
    lines: [{ ...draftLineOf(3, 300), gift: true }],
  })

  test('steps, adding again and a typed quantity keep the Special price', () => {
    const base = withSpecial()
    expect(saleDraftReducer(base, { type: 'stepUp', productId: 3 }).lines).toEqual([{ ...special, quantityHundredths: 400 }])
    expect(saleDraftReducer(base, { type: 'productAdded', productId: 3 }).lines).toEqual([
      { ...special, quantityHundredths: 400 },
    ])
    expect(saleDraftReducer(base, { type: 'stepDown', productId: 3 }).lines).toEqual([
      { ...special, quantityHundredths: 200 },
    ])
    expect(saleDraftReducer(base, { type: 'quantityTyped', productId: 3, text: '7' }).lines).toEqual([
      { ...special, quantityHundredths: 700 },
    ])
  })

  test('steps, adding again and a typed quantity keep the Gift, and stepDown at one step still removes the line', () => {
    const base = withGift()
    const gift = base.lines[0]
    expect(saleDraftReducer(base, { type: 'stepUp', productId: 3 }).lines).toEqual([{ ...gift, quantityHundredths: 400 }])
    expect(saleDraftReducer(base, { type: 'productAdded', productId: 3 }).lines).toEqual([
      { ...gift, quantityHundredths: 400 },
    ])
    expect(saleDraftReducer(base, { type: 'quantityTyped', productId: 3, text: '1,5' }).lines).toEqual([
      { ...gift, quantityHundredths: 150 },
    ])
    const one = saleDraftReducer(base, { type: 'quantityTyped', productId: 3, text: '1' })
    expect(one.lines).toEqual([{ ...gift, quantityHundredths: 100 }])
    expect(saleDraftReducer(one, { type: 'stepDown', productId: 3 }).lines).toEqual([])
  })

  test('lineEdited makes a Gift, a Special price, and a Special price line a Gift', () => {
    const base = run([{ type: 'productAdded', productId: 3 }])
    const gift = saleDraftReducer(base, {
      type: 'lineEdited',
      productId: 3,
      quantityHundredths: 250,
      gift: true,
      specialPrice: null,
    })
    expect(gift.lines).toEqual([{ productId: 3, quantityHundredths: 250, gift: true, specialPrice: null }])
    const priced = saleDraftReducer(base, {
      type: 'lineEdited',
      productId: 3,
      quantityHundredths: 100,
      gift: false,
      specialPrice: 1234.5,
    })
    expect(priced.lines).toEqual([{ productId: 3, quantityHundredths: 100, gift: false, specialPrice: 1234.5 }])
    const back = saleDraftReducer(priced, {
      type: 'lineEdited',
      productId: 3,
      quantityHundredths: 100,
      gift: true,
      specialPrice: null,
    })
    expect(back.lines).toEqual([{ productId: 3, quantityHundredths: 100, gift: true, specialPrice: null }])
  })

  test('lineEdited touches only its own line and accepts exactly the largest quantity', () => {
    const base = run([
      { type: 'productAdded', productId: 3 },
      { type: 'productAdded', productId: 4 },
    ])
    const edited = saleDraftReducer(base, {
      type: 'lineEdited',
      productId: 4,
      quantityHundredths: MAX_QUANTITY_HUNDREDTHS,
      gift: true,
      specialPrice: null,
    })
    expect(edited.lines[0]).toBe(base.lines[0])
    expect(edited.lines[1]?.quantityHundredths).toBe(MAX_QUANTITY_HUNDREDTHS)
  })

  test('lineEdited refuses a Gift together with a Special price', () => {
    const base = withSpecial()
    expect(
      saleDraftReducer(base, { type: 'lineEdited', productId: 3, quantityHundredths: 300, gift: true, specialPrice: 100 }),
    ).toBe(base)
  })

  test.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_VALUE])(
    'lineEdited refuses the Special price %s',
    (specialPrice) => {
      const base = withGift()
      expect(
        saleDraftReducer(base, { type: 'lineEdited', productId: 3, quantityHundredths: 300, gift: false, specialPrice }),
      ).toBe(base)
    },
  )

  test.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, MAX_QUANTITY_HUNDREDTHS + 1])(
    'lineEdited refuses the quantity %s',
    (quantityHundredths) => {
      const base = withSpecial()
      expect(
        saleDraftReducer(base, { type: 'lineEdited', productId: 3, quantityHundredths, gift: false, specialPrice: 5000 }),
      ).toBe(base)
    },
  )

  test('lineEdited for a product not in the draft never creates a line', () => {
    const base = run([{ type: 'productAdded', productId: 3 }])
    expect(
      saleDraftReducer(base, { type: 'lineEdited', productId: 9, quantityHundredths: 100, gift: true, specialPrice: null }),
    ).toBe(base)
  })

  test('lineRemoved takes that line only', () => {
    const base = run([
      { type: 'productAdded', productId: 3 },
      { type: 'productAdded', productId: 4 },
    ])
    expect(saleDraftReducer(base, { type: 'lineRemoved', productId: 3 }).lines).toEqual([draftLineOf(4, 100)])
  })

  test('removing the last line leaves the draft clean with customer, date, shipping, note and owing as they were', () => {
    const base = run([
      { type: 'customerChosen', customerId: 5 },
      { type: 'dateSet', date: '2026-11-01', today: TODAY },
      { type: 'shippingSet', text: '10' },
      { type: 'noteSet', text: 'hi' },
      { type: 'choiceSet', choice: { kind: 'owing' } },
      { type: 'proposalArrived', methodId: 4 },
      { type: 'productAdded', productId: 3 },
    ])
    expect(isDirty(base)).toBe(true)
    const emptied = saleDraftReducer(base, { type: 'lineRemoved', productId: 3 })
    expect(isDirty(emptied)).toBe(false)
    expect(emptied).toEqual({ ...base, lines: [] })
  })

  test('lineRemoved for a product not in the draft leaves the state unchanged', () => {
    const base = run([{ type: 'productAdded', productId: 3 }])
    expect(saleDraftReducer(base, { type: 'lineRemoved', productId: 9 })).toBe(base)
  })
})

describe('isQuantityHundredths and isSpecialPrice', () => {
  test.each([1, 100, MAX_QUANTITY_HUNDREDTHS])('a quantity of %i is allowed', (n) => {
    expect(isQuantityHundredths(n)).toBe(true)
  })
  test.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, MAX_QUANTITY_HUNDREDTHS + 1])(
    'a quantity of %s is refused',
    (n) => {
      expect(isQuantityHundredths(n)).toBe(false)
    },
  )
  test.each([0.01, 1, 5000, 1234.5])('a Special price of %s is allowed', (n) => {
    expect(isSpecialPrice(n)).toBe(true)
  })
  test.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_VALUE])('a Special price of %s is refused', (n) => {
    expect(isSpecialPrice(n)).toBe(false)
  })
})

describe('lineEditOf', () => {
  const buffer = (quantityText: string, gift: boolean, specialText: string) => ({ quantityText, gift, specialText })

  test('a valid buffer gives the edit with the parsed quantity and Special price', () => {
    expect(lineEditOf(buffer('2,5', false, '1.234'), FORMAT)).toMatchObject({
      ok: true,
      edit: { quantityHundredths: 250, gift: false, specialPrice: 1234 },
    })
    expect(lineEditOf(buffer('1', false, '12,5'), FORMAT_CENTS)).toMatchObject({
      ok: true,
      edit: { quantityHundredths: 100, gift: false, specialPrice: 12.5 },
    })
    expect(lineEditOf(buffer('1', true, ''), FORMAT)).toMatchObject({
      ok: true,
      edit: { quantityHundredths: 100, gift: true, specialPrice: null },
    })
  })

  test('a blank Special price text is no Special price, not a refusal', () => {
    for (const specialText of ['', '   ']) {
      expect(lineEditOf(buffer('1', false, specialText), FORMAT)).toMatchObject({
        ok: true,
        edit: { gift: false, specialPrice: null },
      })
    }
  })

  test.each(['0', '', 'abc', '1.234', '-1'])('quantity %j is refused as quantity', (quantityText) => {
    expect(lineEditOf(buffer(quantityText, false, ''), FORMAT)).toEqual({ ok: false, refusal: 'quantity' })
  })

  test('a bad quantity wins over a Gift with a Special price', () => {
    expect(lineEditOf(buffer('0', true, '500'), FORMAT)).toEqual({ ok: false, refusal: 'quantity' })
  })

  test('a Gift with any Special price text is giftWithSpecial, read before the value: even "0"', () => {
    for (const specialText of ['500', '0', 'abc']) {
      expect(lineEditOf(buffer('1', true, specialText), FORMAT)).toEqual({ ok: false, refusal: 'giftWithSpecial' })
    }
  })

  test.each(['abc', '0', '-1', '0,00', '1e3'])('Special price %j is refused as specialZero', (specialText) => {
    expect(lineEditOf(buffer('1', false, specialText), FORMAT_CENTS)).toEqual({ ok: false, refusal: 'specialZero' })
  })

  test('a Special price with more decimals than the Money format keeps is specialZero too', () => {
    expect(lineEditOf(buffer('1', false, '1,555'), FORMAT_CENTS)).toEqual({ ok: false, refusal: 'specialZero' })
  })
})

describe('customer and the owing choice', () => {
  const owing = { kind: 'owing' } as const

  test('removing the customer while owing keeps owing: the draft changes nothing on its own', () => {
    const state = run([
      { type: 'customerChosen', customerId: 5 },
      { type: 'choiceSet', choice: owing },
      { type: 'customerRemoved' },
    ])
    expect(state.customerId).toBeNull()
    expect(state.choice).toEqual(owing)
  })

  test('choiceSet unset after owing leaves nothing remembered', () => {
    const state = run([
      { type: 'customerChosen', customerId: 5 },
      { type: 'choiceSet', choice: { kind: 'paid', payment_method_id: 3 } },
      { type: 'choiceSet', choice: owing },
      { type: 'choiceSet', choice: { kind: 'unset' } },
    ])
    expect(state.choice).toEqual({ kind: 'unset' })
  })

  test('removing the customer keeps paid(id) and unset', () => {
    const paid = run([
      { type: 'customerChosen', customerId: 5 },
      { type: 'choiceSet', choice: { kind: 'paid', payment_method_id: 12 } },
      { type: 'customerRemoved' },
    ])
    expect(paid.choice).toEqual({ kind: 'paid', payment_method_id: 12 })
    expect(run([{ type: 'customerRemoved' }]).choice).toEqual({ kind: 'unset' })
  })

  test('switching to another customer keeps owing', () => {
    const state = run([
      { type: 'customerChosen', customerId: 5 },
      { type: 'choiceSet', choice: owing },
      { type: 'customerChosen', customerId: 6 },
    ])
    expect(state.customerId).toBe(6)
    expect(state.choice).toEqual(owing)
  })

  test('customerChosen keeps a paid choice', () => {
    const state = run([
      { type: 'choiceSet', choice: { kind: 'paid', payment_method_id: 3 } },
      { type: 'customerChosen', customerId: 6 },
    ])
    expect(state.choice).toEqual({ kind: 'paid', payment_method_id: 3 })
  })

  test('choosing owing with no customer is held as is', () => {
    expect(run([{ type: 'choiceSet', choice: owing }]).choice).toEqual(owing)
  })
})

describe('the proposed method', () => {
  test('a late proposal fills proposedMethodId and leaves an unset choice unset', () => {
    const state = run([{ type: 'proposalArrived', methodId: 4 }])
    expect(state.proposedMethodId).toBe(4)
    expect(state.choice).toEqual({ kind: 'unset' })
  })

  test('a late proposal never overwrites paid(id) or owing', () => {
    const paid = run([
      { type: 'choiceSet', choice: { kind: 'paid', payment_method_id: 9 } },
      { type: 'proposalArrived', methodId: 4 },
    ])
    expect(paid.choice).toEqual({ kind: 'paid', payment_method_id: 9 })
    expect(paid.proposedMethodId).toBe(4)
    const owing = run([
      { type: 'choiceSet', choice: { kind: 'owing' } },
      { type: 'proposalArrived', methodId: 4 },
    ])
    expect(owing.choice).toEqual({ kind: 'owing' })
    expect(owing.proposedMethodId).toBe(4)
  })

  test('a null proposal clears it', () => {
    const state = run([
      { type: 'proposalArrived', methodId: 4 },
      { type: 'proposalArrived', methodId: null },
    ])
    expect(state.proposedMethodId).toBeNull()
  })
})

describe('effectiveChoice', () => {
  test('paid and owing are returned as the seller chose them, offered or not', () => {
    const paid = { kind: 'paid', payment_method_id: 9 } as const
    expect(effectiveChoice(paid, 4, [4])).toEqual(paid)
    expect(effectiveChoice(paid, null, null)).toEqual(paid)
    expect(effectiveChoice({ kind: 'owing' }, 4, [4])).toEqual({ kind: 'owing' })
    expect(effectiveChoice({ kind: 'owing' }, 4, null)).toEqual({ kind: 'owing' })
  })

  test('unset yields the proposal only when it is among the offered methods', () => {
    const unset = { kind: 'unset' } as const
    expect(effectiveChoice(unset, 4, [2, 4])).toEqual({ kind: 'paid', payment_method_id: 4 })
    expect(effectiveChoice(unset, 4, [2, 3])).toBeNull()
    expect(effectiveChoice(unset, 4, [])).toBeNull()
  })

  test('unset yields nothing with no offered list yet or no proposal', () => {
    const unset = { kind: 'unset' } as const
    expect(effectiveChoice(unset, 4, null)).toBeNull()
    expect(effectiveChoice(unset, null, [4])).toBeNull()
  })
})

describe('dates and free text', () => {
  test('dateSet moves date only and never openedOn', () => {
    const state = run([{ type: 'dateSet', date: '2026-11-01', today: TODAY }])
    expect(state.date).toBe('2026-11-01')
    expect(state.openedOn).toBe(TODAY)
  })

  test.each(['', '2026-1-05', '2026-11-5', '19/11/2026', '2026-02-30', '2026-13-01', '0000-01-01', '2026-11-20', '2027-01-01'])(
    'dateSet refuses %j and keeps the last valid date',
    (date) => {
      const base = run([{ type: 'dateSet', date: '2026-11-01', today: TODAY }])
      expect(saleDraftReducer(base, { type: 'dateSet', date, today: TODAY })).toBe(base)
    },
  )

  test('dateSet accepts today and any real earlier day, with no lower bound', () => {
    expect(run([{ type: 'dateSet', date: TODAY, today: TODAY }]).date).toBe(TODAY)
    expect(run([{ type: 'dateSet', date: '2026-11-18', today: TODAY }]).date).toBe('2026-11-18')
    expect(run([{ type: 'dateSet', date: '2016-02-29', today: TODAY }]).date).toBe('2016-02-29')
  })

  test('dateSet judges the date against the today it carries', () => {
    expect(run([{ type: 'dateSet', date: '2026-11-20', today: '2026-11-20' }]).date).toBe('2026-11-20')
  })

  test('shipping and note are stored exactly as typed', () => {
    const state = run([
      { type: 'shippingSet', text: ' 1.5,0 ' },
      { type: 'noteSet', text: '  hola  ' },
    ])
    expect(state.shipping).toBe(' 1.5,0 ')
    expect(state.note).toBe('  hola  ')
  })

  test('every action keeps openedOn', () => {
    const actions: DraftAction[] = [
      { type: 'productAdded', productId: 1 },
      { type: 'stepUp', productId: 1 },
      { type: 'stepDown', productId: 1 },
      { type: 'quantityTyped', productId: 1, text: '3' },
      { type: 'customerChosen', customerId: 2 },
      { type: 'customerRemoved' },
      { type: 'choiceSet', choice: { kind: 'owing' } },
      { type: 'proposalArrived', methodId: 3 },
      { type: 'dateSet', date: '2020-01-01', today: TODAY },
      { type: 'shippingSet', text: '1' },
      { type: 'noteSet', text: 'n' },
    ]
    let state = initialDraft({ today: TODAY })
    for (const action of actions) {
      state = saleDraftReducer(state, action)
      expect(state.openedOn).toBe(TODAY)
    }
  })
})

describe('typedQuantity', () => {
  test.each([
    '0',
    '0.00',
    '',
    '  ',
    'abc',
    '.5',
    '5.',
    '1e2',
    '0.005',
    '1.234',
    '9007199254740993',
    '10000000000000',
  ])('refuses %j', (text) => {
    expect(typedQuantity(text)).toBeNull()
  })

  test.each([
    ['1,5', 150],
    ['007', 700],
    [' 2 ', 200],
    ['0.01', 1],
    ['9999999999999.99', 999999999999999],
    ['00000000000000001', 100],
  ])('accepts %j as %i hundredths', (text, hundredths) => {
    expect(typedQuantity(text)).toBe(hundredths)
  })
})

describe('lineBufferOf', () => {
  test('seeds the quantity as the row shows it and the Special price as the field prefills it', () => {
    expect(lineBufferOf({ ...draftLineOf(1, 250), specialPrice: 1234 }, FORMAT)).toEqual({
      quantityText: '2,5',
      gift: false,
      specialText: '1234',
    })
    expect(lineBufferOf({ ...draftLineOf(1, 200), specialPrice: 12.5 }, FORMAT_CENTS).specialText).toBe('12,50')
  })

  test('a line with no Special price seeds a blank text, and a Gift seeds gift on', () => {
    expect(lineBufferOf(draftLineOf(1, 100), FORMAT)).toEqual({ quantityText: '1', gift: false, specialText: '' })
    expect(lineBufferOf({ ...draftLineOf(1, 100), gift: true }, FORMAT).gift).toBe(true)
  })
})

describe('lineBufferWith', () => {
  const base = { quantityText: '2', gift: false, specialText: '' }

  test('turning Gift on empties the Special price text, turning it off leaves it', () => {
    expect(lineBufferWith({ ...base, specialText: '500' }, { gift: true })).toEqual({
      quantityText: '2',
      gift: true,
      specialText: '',
    })
    expect(lineBufferWith({ ...base, gift: true }, { gift: false })).toEqual(base)
  })

  test('a non-blank Special price text turns Gift off; a blank one leaves it', () => {
    expect(lineBufferWith({ ...base, gift: true }, { specialText: '500' })).toEqual({
      quantityText: '2',
      gift: false,
      specialText: '500',
    })
    expect(lineBufferWith({ ...base, gift: true }, { specialText: '  ' }).gift).toBe(true)
  })

  test('a quantity edit leaves Gift and the Special price text as they are', () => {
    const held = { quantityText: '2', gift: false, specialText: '500' }
    expect(lineBufferWith(held, { quantityText: '3' })).toEqual({ ...held, quantityText: '3' })
  })
})

describe('lineEditChanged', () => {
  const line = { ...draftLineOf(1, 200), specialPrice: 1234 }
  const seed = lineBufferOf(line, FORMAT)

  test('the seeded buffer is no change', () => {
    expect(lineEditChanged(line, seed, FORMAT)).toBe(false)
  })

  test('the same quantity written another way is no change', () => {
    for (const quantityText of ['2', '2,00', '2,0']) {
      expect(lineEditChanged(line, { ...seed, quantityText }, FORMAT)).toBe(false)
    }
  })

  test('another quantity, a Gift toggle or another Special price is a change', () => {
    expect(lineEditChanged(line, { ...seed, quantityText: '2,5' }, FORMAT)).toBe(true)
    expect(lineEditChanged(line, lineBufferWith(seed, { gift: true }), FORMAT)).toBe(true)
    expect(lineEditChanged(line, { ...seed, specialText: '1235' }, FORMAT)).toBe(true)
    expect(lineEditChanged(line, { ...seed, specialText: '' }, FORMAT)).toBe(true)
  })

  test('a refused buffer counts as changed', () => {
    expect(lineEditChanged(line, { ...seed, quantityText: '' }, FORMAT)).toBe(true)
    expect(lineEditChanged(line, { ...seed, specialText: '0' }, FORMAT)).toBe(true)
  })
})
