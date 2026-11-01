/**
 * `chromeOf` at its seam: a hand-written table with one row per registered screen id, for
 * both viewports. Nothing in the expectations is derived from a screen's kind, so a wrong
 * kind in the registry, or a new screen or modal route without a row, fails here.
 */

import { expect, test } from 'vitest'
import { SCREENS, screen as declare, screenOf, type ScreenId } from '../routes'
import { chromeOf, type Chrome } from './chrome'

const ROOT: Chrome = { rail: true, railNuevaVenta: true, barNuevaVenta: true, bar: true, backArrow: false }
const CARD: Chrome = { rail: true, railNuevaVenta: false, barNuevaVenta: false, bar: true, backArrow: true }
const FORM: Chrome = { rail: true, railNuevaVenta: false, barNuevaVenta: false, bar: false, backArrow: false }
const MODAL_FORM: Chrome = { ...FORM, rail: false }

/** Phone, then computer; the same on both unless a row says otherwise. */
const EXPECTED: Record<ScreenId, readonly [Chrome, Chrome]> = {
  home: [ROOT, ROOT],
  more: [ROOT, ROOT],
  sales: [ROOT, ROOT],
  'sale-new': [FORM, FORM],
  sale: [CARD, CARD],
  customers: [ROOT, ROOT],
  'customer-new': [FORM, FORM],
  customer: [CARD, CARD],
  'customer-edit': [FORM, FORM],
  'customer-payment': [FORM, MODAL_FORM],
  varieties: [ROOT, ROOT],
  variety: [CARD, CARD],
  'variety-new': [FORM, FORM],
  'variety-prices': [CARD, CARD],
  'variety-price-new': [FORM, MODAL_FORM],
  'variety-entries': [CARD, CARD],
  catalog: [CARD, CARD],
  stock: [CARD, CARD],
  'stock-entry-new': [FORM, FORM],
  'stock-entry': [FORM, FORM],
  'varieties-archived': [CARD, CARD],
  'withdrawal-new': [FORM, FORM],
  withdrawal: [CARD, CARD],
  'withdrawal-edit': [FORM, FORM],
  expenses: [ROOT, ROOT],
  'expense-new': [FORM, FORM],
  analysis: [ROOT, ROOT],
  settings: [CARD, CARD],
  'settings-business': [FORM, FORM],
  'settings-users': [FORM, FORM],
  'settings-products': [FORM, FORM],
  'settings-units': [FORM, FORM],
  'settings-prices': [FORM, FORM],
  'settings-integrations': [FORM, FORM],
  'settings-catalog-message': [FORM, FORM],
  'settings-expense-categories': [FORM, FORM],
  'settings-appearance': [FORM, FORM],
  'settings-account': [FORM, FORM],
  onboarding: [FORM, FORM],
  'onboarding-variety': [FORM, FORM],
  'onboarding-stock': [FORM, FORM],
  'onboarding-catalog-message': [FORM, FORM],
  'onboarding-bot': [FORM, FORM],
  'onboarding-partner': [FORM, FORM],
  'onboarding-categories': [FORM, FORM],
  'onboarding-done': [FORM, FORM],
}

test('the table has a row for every registered screen and for nothing else', () => {
  expect(Object.keys(EXPECTED).sort()).toEqual(SCREENS.map((entry) => entry.id).sort())
})

test.each(Object.entries(EXPECTED).flatMap(([id, [phone, computer]]) => [
  [id, 'phone', phone],
  [id, 'computer', computer],
] as const))('%s on a %s draws the chrome the table says', (id, viewport, expected) => {
  expect(chromeOf(screenOf(id as ScreenId), viewport)).toEqual(expected)
})

test('a two-pane detail is a card: no "+ Nueva venta" in the rail and its rail stays', () => {
  const detail = declare({
    id: 'customer',
    path: '/x',
    kind: 'card',
    titleKey: 'common:home',
    pane: 'detail',
    parent: 'customers',
  })

  expect(chromeOf(detail, 'computer')).toEqual(CARD)
})

test('only the explicit modalOnComputer hides the rail, and only on a computer', () => {
  const modal = declare({
    id: 'sale-new',
    path: '/x',
    kind: 'form',
    titleKey: 'common:home',
    parent: 'sales',
    modalOnComputer: true,
  })
  const plainForm = declare({ id: 'sale-new', path: '/x', kind: 'form', titleKey: 'common:home', parent: 'sales' })

  expect(chromeOf(modal, 'computer').rail).toBe(false)
  expect(chromeOf(modal, 'phone').rail).toBe(true)
  expect(chromeOf(plainForm, 'computer').rail).toBe(true)
})

test('no form, on either viewport, shows "+ Nueva venta" in the rail or on the bar', () => {
  const forms = SCREENS.filter((entry) => entry.kind === 'form')
  expect(forms.length).toBeGreaterThan(0)
  for (const form of forms) {
    for (const viewport of ['phone', 'computer'] as const) {
      const chrome = chromeOf(form, viewport)
      expect({ id: form.id, viewport, rail: chrome.railNuevaVenta, bar: chrome.barNuevaVenta }).toEqual({
        id: form.id,
        viewport,
        rail: false,
        bar: false,
      })
    }
  }
})
