import { describe, expect, test } from 'vitest'
import {
  MAX_QUANTITY_HUNDREDTHS,
  effectiveChoice,
  initialDraft,
  isDirty,
  saleDraftReducer,
  typedQuantity,
  type DraftAction,
  type DraftState,
} from './saleDraft'

const TODAY = '2026-11-19'

function run(actions: DraftAction[], from: DraftState = initialDraft({ today: TODAY })): DraftState {
  return actions.reduce(saleDraftReducer, from)
}

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
      { productId: 3, quantityHundredths: 100 },
    ])
  })

  test('adding a product already in the sale raises its line and never makes a second', () => {
    const state = run([
      { type: 'productAdded', productId: 3 },
      { type: 'productAdded', productId: 4 },
      { type: 'productAdded', productId: 3 },
    ])
    expect(state.lines).toEqual([
      { productId: 3, quantityHundredths: 200 },
      { productId: 4, quantityHundredths: 100 },
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
    expect(at150.lines).toEqual([{ productId: 3, quantityHundredths: 150 }])
    const at50 = saleDraftReducer(at150, { type: 'stepDown', productId: 3 })
    expect(at50.lines).toEqual([{ productId: 3, quantityHundredths: 50 }])
    expect(saleDraftReducer(at50, { type: 'stepDown', productId: 3 }).lines).toEqual([])
  })

  test('stepDown from exactly one whole unit removes the line, and from 200 gives 100', () => {
    const one = run([{ type: 'productAdded', productId: 3 }])
    expect(saleDraftReducer(one, { type: 'stepDown', productId: 3 }).lines).toEqual([])
    const two = saleDraftReducer(one, { type: 'stepUp', productId: 3 })
    expect(saleDraftReducer(two, { type: 'stepDown', productId: 3 }).lines).toEqual([
      { productId: 3, quantityHundredths: 100 },
    ])
  })

  test('a typed quantity replaces the line quantity', () => {
    const state = run([
      { type: 'productAdded', productId: 3 },
      { type: 'quantityTyped', productId: 3, text: '2.25' },
    ])
    expect(state.lines).toEqual([{ productId: 3, quantityHundredths: 225 }])
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
      { type: 'dateSet', date: '2026-11-01' },
      { type: 'choiceSet', choice: { kind: 'owing' } },
    ])
    expect(isDirty(empty)).toBe(false)
    const withLine = saleDraftReducer(empty, { type: 'productAdded', productId: 1 })
    expect(isDirty(withLine)).toBe(true)
    expect(isDirty(saleDraftReducer(withLine, { type: 'stepDown', productId: 1 }))).toBe(false)
  })
})

describe('customer and the owing choice', () => {
  const owing = { kind: 'owing' } as const

  test('removing the customer while owing resets the choice to unset', () => {
    const state = run([
      { type: 'customerChosen', customerId: 5 },
      { type: 'choiceSet', choice: owing },
      { type: 'customerRemoved' },
    ])
    expect(state.customerId).toBeNull()
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
    const state = run([{ type: 'dateSet', date: '2026-11-01' }])
    expect(state.date).toBe('2026-11-01')
    expect(state.openedOn).toBe(TODAY)
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
      { type: 'dateSet', date: '2020-01-01' },
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
