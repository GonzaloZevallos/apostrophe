/**
 * `scrollOnArrival` at its seam: a hand-written table over the real registry. Every screen id
 * is spelled out below with what the seller sees on each viewport, so a screen added to
 * `SCREENS` without a row, or a registry flag that changes, fails this file.
 */

import { expect, test } from 'vitest'
import { HOME, LOGIN, SALES, SCREENS, type ScreenId, type Viewport } from '../routes'
import { FORM_DRAWING, TWO_PANE_LAYOUT, scrollOnArrival, type Arrival, type NavigationType } from './scrollOnArrival'

function at(screen: ScreenId | undefined, pathname = `screen:${screen ?? 'outside'}`, sheetDepth = 0): Arrival {
  return { screen, pathname, sheetDepth }
}

type Outcome = 'top' | 'keep'

/** Reached by PUSH from a tab root (`sales`), what each screen does on the phone and on the computer. */
const FROM_A_TAB_ROOT: Record<ScreenId, { phone: Outcome; computer: Outcome }> = {
  home: { phone: 'top', computer: 'top' },
  more: { phone: 'top', computer: 'top' },
  sales: { phone: 'top', computer: 'top' },
  'sale-new': { phone: 'keep', computer: 'top' },
  sale: { phone: 'top', computer: 'top' },
  customers: { phone: 'top', computer: 'top' },
  'customer-new': { phone: 'keep', computer: 'top' },
  customer: { phone: 'top', computer: 'top' },
  'customer-edit': { phone: 'keep', computer: 'top' },
  'customer-payment': { phone: 'keep', computer: 'keep' },
  varieties: { phone: 'top', computer: 'top' },
  variety: { phone: 'top', computer: 'top' },
  'variety-new': { phone: 'keep', computer: 'top' },
  'variety-prices': { phone: 'top', computer: 'top' },
  'variety-price-new': { phone: 'keep', computer: 'keep' },
  'variety-entries': { phone: 'top', computer: 'top' },
  catalog: { phone: 'top', computer: 'top' },
  stock: { phone: 'top', computer: 'top' },
  'stock-entry-new': { phone: 'keep', computer: 'top' },
  'stock-entry': { phone: 'keep', computer: 'top' },
  'varieties-archived': { phone: 'top', computer: 'top' },
  'withdrawal-new': { phone: 'keep', computer: 'top' },
  withdrawal: { phone: 'top', computer: 'top' },
  'withdrawal-edit': { phone: 'keep', computer: 'top' },
  expenses: { phone: 'top', computer: 'top' },
  'expense-new': { phone: 'keep', computer: 'top' },
  analysis: { phone: 'top', computer: 'top' },
  settings: { phone: 'top', computer: 'top' },
  'settings-business': { phone: 'top', computer: 'top' },
  'settings-users': { phone: 'top', computer: 'top' },
  'settings-prices': { phone: 'top', computer: 'top' },
  'settings-integrations': { phone: 'top', computer: 'top' },
  'settings-catalog-message': { phone: 'top', computer: 'top' },
  'settings-expense-categories': { phone: 'top', computer: 'top' },
  'settings-appearance': { phone: 'top', computer: 'top' },
  'settings-account': { phone: 'top', computer: 'top' },
  onboarding: { phone: 'top', computer: 'top' },
  'onboarding-variety': { phone: 'top', computer: 'top' },
  'onboarding-stock': { phone: 'top', computer: 'top' },
  'onboarding-catalog-message': { phone: 'top', computer: 'top' },
  'onboarding-bot': { phone: 'top', computer: 'top' },
  'onboarding-partner': { phone: 'top', computer: 'top' },
  'onboarding-categories': { phone: 'top', computer: 'top' },
  'onboarding-done': { phone: 'top', computer: 'top' },
}

const VIEWPORTS: readonly Viewport[] = ['phone', 'computer']

test('the table names every registry screen, and nothing else', () => {
  expect(Object.keys(FROM_A_TAB_ROOT).sort()).toEqual(SCREENS.map((entry) => entry.id).sort())
})

test('every screen reached by PUSH from a tab root does what the table says, on both viewports', () => {
  for (const entry of SCREENS) {
    for (const viewport of VIEWPORTS) {
      const decision = scrollOnArrival(at('sales', SALES), at(entry.id, `to:${entry.id}`), 'PUSH', viewport)
      expect(decision, `${entry.id} on the ${viewport}`).toBe(FROM_A_TAB_ROOT[entry.id][viewport])
    }
  }
})

test('the forms the phone does not draw over a page are exactly the settings groups and the onboarding steps', () => {
  const flows = Object.entries(FORM_DRAWING)
    .filter(([, drawing]) => drawing === 'flow')
    .map(([id]) => id)
  expect(flows.every((id) => id.startsWith('settings-') || id.startsWith('onboarding'))).toBe(true)
  const over = Object.entries(FORM_DRAWING)
    .filter(([, drawing]) => drawing === 'over')
    .map(([id]) => id)
  expect(over.sort()).toEqual(
    [
      'sale-new',
      'customer-new',
      'customer-edit',
      'customer-payment',
      'variety-new',
      'variety-price-new',
      'stock-entry-new',
      'stock-entry',
      'withdrawal-new',
      'withdrawal-edit',
      'expense-new',
    ].sort(),
  )
  expect(flows.length + over.length).toBe(SCREENS.filter((entry) => entry.kind === 'form').length)
})

test('a POP to a different path restores, on every screen pair and both viewports', () => {
  for (const from of SCREENS) {
    for (const to of SCREENS) {
      if (from.id === to.id) continue
      for (const viewport of VIEWPORTS) {
        expect(scrollOnArrival(at(from.id), at(to.id), 'POP', viewport), `${from.id} -> ${to.id}`).toBe('restore')
      }
    }
  }
  expect(scrollOnArrival(at(undefined, LOGIN), at('home', HOME), 'POP', 'phone')).toBe('restore')
})

test('a POP to the same path at equal sheet depth restores (go(-2) from a re-tapped tab)', () => {
  for (const viewport of VIEWPORTS) {
    expect(scrollOnArrival(at('sales', SALES, 0), at('sales', SALES, 0), 'POP', viewport)).toBe('restore')
    expect(scrollOnArrival(at('sales', SALES, 1), at('sales', SALES, 1), 'POP', viewport)).toBe('restore')
  }
})

test('a POP to the same path that opens or closes an in-page sheet keeps the page', () => {
  for (const viewport of VIEWPORTS) {
    expect(scrollOnArrival(at('sales', SALES, 1), at('sales', SALES, 0), 'POP', viewport)).toBe('keep')
    expect(scrollOnArrival(at('sales', SALES, 0), at('sales', SALES, 1), 'POP', viewport)).toBe('keep')
    expect(scrollOnArrival(at('sales', SALES, 2), at('sales', SALES, 0), 'POP', viewport)).toBe('keep')
  }
})

test('a same-path PUSH or REPLACE keeps the page: search, filters, month, a sheet stacked on the screen', () => {
  const types: readonly NavigationType[] = ['PUSH', 'REPLACE']
  for (const entry of SCREENS) {
    for (const type of types) {
      for (const viewport of VIEWPORTS) {
        expect(scrollOnArrival(at(entry.id, 'same'), at(entry.id, 'same'), type, viewport), `${entry.id} ${type}`).toBe('keep')
        expect(scrollOnArrival(at(entry.id, 'same', 0), at(entry.id, 'same', 1), type, viewport), `${entry.id} ${type} sheet`).toBe('keep')
      }
    }
  }
})

test('a tab, a link, a list row into its card and a redirect to a different path open at the top', () => {
  const cases: Array<[ScreenId | undefined, ScreenId | undefined]> = [
    ['home', 'sales'],
    ['sales', 'customers'],
    ['more', 'settings'],
    ['sales', 'sale'],
    ['varieties', 'catalog'],
    ['variety', 'variety-prices'],
    ['settings', 'expenses'],
    [undefined, 'home'],
    ['home', undefined],
    ['sales', 'onboarding'],
    ['onboarding-done', 'home'],
  ]
  const types: readonly NavigationType[] = ['PUSH', 'REPLACE']
  for (const [prev, next] of cases) {
    for (const type of types) {
      for (const viewport of VIEWPORTS) {
        expect(scrollOnArrival(at(prev), at(next), type, viewport), `${prev} -> ${next} ${type} ${viewport}`).toBe('top')
      }
    }
  }
})

test('on a computer a pick inside one two-pane layout keeps the list; on the phone it opens at the top', () => {
  const picks: Array<[ScreenId, ScreenId]> = [
    ['customers', 'customer'],
    ['customer', 'customer'],
    ['varieties', 'variety'],
    ['variety', 'variety'],
    ['varieties', 'variety-new'],
    ['varieties-archived', 'variety'],
    ['variety', 'varieties-archived'],
  ]
  for (const [prev, next] of picks) {
    for (const type of ['PUSH', 'REPLACE'] as const) {
      expect(scrollOnArrival(at(prev), at(next), type, 'computer'), `${prev} -> ${next} ${type}`).toBe('keep')
    }
  }
  expect(scrollOnArrival(at('customers'), at('customer'), 'PUSH', 'phone')).toBe('top')
  expect(scrollOnArrival(at('varieties'), at('variety'), 'REPLACE', 'phone')).toBe('top')
})

test('across two-pane layouts, or out of one, the computer opens at the top', () => {
  const tops: Array<[ScreenId, ScreenId]> = [
    ['customers', 'variety'],
    ['varieties', 'customer'],
    ['sales', 'customer'],
    ['customer', 'sales'],
    ['variety', 'variety-prices'],
    ['variety', 'catalog'],
  ]
  for (const [prev, next] of tops) {
    expect(scrollOnArrival(at(prev), at(next), 'PUSH', 'computer'), `${prev} -> ${next}`).toBe('top')
  }
})

// `tsc` keeps `FORM_DRAWING` to the forms: a form left out of the record fails the declaration
// itself, and these two are true only while it holds exactly the registry's forms.
type Drawn = keyof typeof FORM_DRAWING
const aFormIsPlaced: ['sale-new'] extends [Drawn] ? true : false = true
const aRootIsNotAForm: ['sales'] extends [Drawn] ? false : true = true

test('every screen the registry gives a pane, and the new-variety form, is placed in a two-pane layout', () => {
  expect(aFormIsPlaced && aRootIsNotAForm).toBe(true)
  const withPane = SCREENS.filter((entry) => 'pane' in entry).map((entry) => entry.id)
  expect(withPane.length).toBeGreaterThan(0)
  expect(Object.keys(TWO_PANE_LAYOUT).sort()).toEqual([...withPane, 'variety-new'].sort())
})
