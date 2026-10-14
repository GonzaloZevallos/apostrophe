/**
 * `chromeOf` at its pure seam: every registry entry on the phone and on a computer, with the
 * record archived, not archived and unknown. The host, the arrow (parent and label), the
 * "+ Nueva venta", the bar and the marks are the whole answer; `Shell` only draws it.
 */

import { expect, test } from 'vitest'
import { SCREENS, screenOf, type ScreenFacts, type Viewport } from '../routes'
import { chromeOf } from './chrome'

const YES: ScreenFacts = { archived: 'yes', varietyName: 'Cherry' }
const NO: ScreenFacts = { archived: 'no', varietyName: 'Cherry' }
const UNKNOWN: ScreenFacts = { archived: 'unknown', varietyName: null }
const VIEWPORTS: Viewport[] = ['phone', 'computer']

const cases = SCREENS.flatMap((entry) =>
  VIEWPORTS.flatMap((viewport) =>
    ([YES, NO, UNKNOWN] as const).map((facts) => [entry.id, viewport, facts.archived, facts] as const),
  ),
)

test.each(cases)('%s on %s, archived %s: chrome follows the host\'s kind alone', (id, viewport, _archived, facts) => {
  const leaf = screenOf(id)
  const chrome = chromeOf(leaf, viewport, facts)
  const host = screenOf(chrome.host)

  expect(chrome.nuevaVenta).toBe(host.kind === 'root')
  expect(chrome.bar).toBe(host.kind !== 'form')
  expect(chrome.backArrow !== null).toBe(host.kind === 'card')
  const twoPaneDetail = viewport === 'computer' && leaf.pane === 'detail'
  if (!twoPaneDetail) expect(chrome.host).toBe(id)
})

test('a customer on a computer takes Clientes: the rail\'s "+ Nueva venta", no arrow, the Clientes mark', () => {
  const chrome = chromeOf(screenOf('customer'), 'computer', UNKNOWN)

  expect(chrome).toEqual({
    host: 'customers',
    backArrow: null,
    nuevaVenta: true,
    bar: true,
    place: { bar: 'customers', rail: 'customers' },
  })
})

test('a customer on the phone is a card: "‹ Clientes", no "+ Nueva venta"', () => {
  const chrome = chromeOf(screenOf('customer'), 'phone', UNKNOWN)

  expect(chrome.host).toBe('customer')
  expect(chrome.backArrow?.title).toBe('Clientes')
  expect(chrome.nuevaVenta).toBe(false)
  expect(chrome.place).toEqual({ bar: 'customers', rail: 'customers' })
})

test.each([
  ['archived', YES],
])('a variety on a computer, %s, takes Archivadas: one "‹ Variedades", no "+ Nueva venta", the Variedades mark', (_n, facts) => {
  const chrome = chromeOf(screenOf('variety'), 'computer', facts)

  expect(chrome.host).toBe('varieties-archived')
  expect(chrome.backArrow?.title).toBe('Variedades')
  expect(chrome.nuevaVenta).toBe(false)
  expect(chrome.place).toEqual({ bar: 'varieties', rail: 'varieties' })
})

test.each([
  ['not archived', NO],
  ['unknown', UNKNOWN],
])('a variety on a computer, %s, takes Variedades: "+ Nueva venta", no arrow', (_n, facts) => {
  const chrome = chromeOf(screenOf('variety'), 'computer', facts)

  expect(chrome.host).toBe('varieties')
  expect(chrome.backArrow).toBeNull()
  expect(chrome.nuevaVenta).toBe(true)
  expect(chrome.place).toEqual({ bar: 'varieties', rail: 'varieties' })
})

test.each([
  [YES, 'Archivadas'],
  [NO, 'Variedades'],
  [UNKNOWN, 'Variedades'],
])('a variety on the phone reads its parent from the record: %j gives "‹ %s"', (facts, label) => {
  const chrome = chromeOf(screenOf('variety'), 'phone', facts)

  expect(chrome.host).toBe('variety')
  expect(chrome.backArrow?.title).toBe(label)
  expect(chrome.nuevaVenta).toBe(false)
})

test('a variety\'s prices on the phone read "‹ <name>", or "‹ Variedad" while the name is unknown', () => {
  const named = chromeOf(screenOf('variety-prices'), 'phone', NO)
  const unnamed = chromeOf(screenOf('variety-prices'), 'phone', UNKNOWN)

  expect(named.backArrow).toMatchObject({ id: 'variety', title: 'Cherry' })
  expect(unnamed.backArrow).toMatchObject({ id: 'variety', title: 'Variedad' })
})

test('Archivadas on a computer is a card with its one "‹ Variedades" and no "+ Nueva venta"', () => {
  const chrome = chromeOf(screenOf('varieties-archived'), 'computer', UNKNOWN)

  expect(chrome.host).toBe('varieties-archived')
  expect(chrome.backArrow?.title).toBe('Variedades')
  expect(chrome.nuevaVenta).toBe(false)
})

test('Configuración\'s arrow differs by viewport: Más on the phone, Inicio on a computer', () => {
  expect(chromeOf(screenOf('settings'), 'phone', UNKNOWN).backArrow?.title).toBe('Más')
  expect(chromeOf(screenOf('settings'), 'computer', UNKNOWN).backArrow?.title).toBe('Inicio')
})
