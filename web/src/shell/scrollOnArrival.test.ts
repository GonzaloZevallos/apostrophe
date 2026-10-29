/**
 * `scrollOnArrival` at its seam: a hand-written table over the real registry. Each screen id
 * is named here by what the seller sees, so a screen added to `SCREENS` without a row, or a
 * registry flag that changes, fails this file.
 */

import { expect, test } from 'vitest'
import { HOME, LOGIN, SCREENS, screenOf, type ScreenId } from '../routes'
import { scrollOnArrival, type Arrival, type NavigationType } from './scrollOnArrival'

function at(screen: ScreenId | undefined, pathname = `screen:${screen ?? 'outside'}`): Arrival {
  return { screen, pathname }
}

/** Forms the phone draws as a sheet over the page it came from. */
const PHONE_SHEETS: readonly ScreenId[] = [
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
  'settings-business',
  'settings-users',
  'settings-prices',
  'settings-integrations',
  'settings-catalog-message',
  'settings-expense-categories',
  'settings-appearance',
  'settings-account',
]

const ONBOARDING: readonly ScreenId[] = [
  'onboarding',
  'onboarding-variety',
  'onboarding-stock',
  'onboarding-catalog-message',
  'onboarding-bot',
  'onboarding-partner',
  'onboarding-categories',
  'onboarding-done',
]

const COMPUTER_MODALS: readonly ScreenId[] = ['customer-payment', 'variety-price-new']

const PUSH_LIKE: readonly NavigationType[] = ['PUSH', 'REPLACE']

test('every registry screen is classified here exactly once', () => {
  const classified = new Set<ScreenId>([...PHONE_SHEETS, ...ONBOARDING])
  const forms = SCREENS.filter((entry) => entry.kind === 'form').map((entry) => entry.id)
  expect([...classified].sort()).toEqual([...forms].sort())
  expect(SCREENS.map((entry) => screenOf(entry.id)).filter((entry) => entry.modalOnComputer === true).map((entry) => entry.id).sort()).toEqual(
    [...COMPUTER_MODALS].sort(),
  )
})

test('Back and Forward restore, on every screen pair and both viewports', () => {
  for (const from of SCREENS) {
    for (const to of SCREENS) {
      for (const viewport of ['phone', 'computer'] as const) {
        expect(scrollOnArrival(at(from.id), at(to.id), 'POP', viewport)).toBe('restore')
      }
    }
  }
  expect(scrollOnArrival(at(undefined, LOGIN), at('home', HOME), 'POP', 'phone')).toBe('restore')
})

test('the same path keeps the page: a query, a fragment, a re-tap, a sheet stack', () => {
  for (const entry of SCREENS) {
    for (const type of PUSH_LIKE) {
      for (const viewport of ['phone', 'computer'] as const) {
        expect(scrollOnArrival(at(entry.id, 'same'), at(entry.id, 'same'), type, viewport)).toBe('keep')
      }
    }
  }
})

test('a tab, a link, a list row and a redirect to a different path open at the top', () => {
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
  for (const [prev, next] of cases) {
    for (const type of PUSH_LIKE) {
      for (const viewport of ['phone', 'computer'] as const) {
        expect(scrollOnArrival(at(prev), at(next), type, viewport), `${prev} -> ${next} ${viewport}`).toBe('top')
      }
    }
  }
})

test('a phone sheet is drawn over the page: the offset stays; the Onboarding forms are pages', () => {
  for (const sheet of PHONE_SHEETS) {
    expect(scrollOnArrival(at('customers'), at(sheet), 'PUSH', 'phone'), sheet).toBe('keep')
  }
  for (const page of ONBOARDING) {
    expect(scrollOnArrival(at('home'), at(page), 'PUSH', 'phone'), page).toBe('top')
  }
})

test('a computer keeps the page only under a modal route, and opens other forms at the top', () => {
  for (const modal of COMPUTER_MODALS) {
    expect(scrollOnArrival(at('customers'), at(modal), 'PUSH', 'computer'), modal).toBe('keep')
  }
  expect(screenOf('customer-new').kind).toBe('form')
  for (const wide of ['sale-new', 'customer-new', 'customer-edit', 'stock-entry-new', 'withdrawal-new', 'settings-business'] as const) {
    expect(scrollOnArrival(at('sales'), at(wide), 'PUSH', 'computer'), wide).toBe('top')
  }
})

test('on a computer a pick inside one two-pane layout keeps the list; across layouts it opens at the top', () => {
  const keeps: Array<[ScreenId, ScreenId]> = [
    ['customers', 'customer'],
    ['customer', 'customer'],
    ['varieties', 'variety'],
    ['variety', 'variety'],
    ['varieties', 'variety-new'],
    ['variety', 'variety-new'],
    ['varieties-archived', 'variety'],
    ['variety', 'varieties-archived'],
  ]
  for (const [prev, next] of keeps) {
    expect(scrollOnArrival(at(prev), at(next), 'PUSH', 'computer'), `${prev} -> ${next}`).toBe('keep')
    expect(scrollOnArrival(at(prev), at(next), 'REPLACE', 'computer'), `${prev} -> ${next} replace`).toBe('keep')
  }
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

test('on the phone a list row into its card opens at the top', () => {
  expect(scrollOnArrival(at('customers'), at('customer'), 'PUSH', 'phone')).toBe('top')
  expect(scrollOnArrival(at('varieties'), at('variety'), 'PUSH', 'phone')).toBe('top')
  expect(scrollOnArrival(at('varieties'), at('variety-new'), 'PUSH', 'phone')).toBe('keep')
})
