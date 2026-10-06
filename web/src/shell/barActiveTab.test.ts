/**
 * `barActiveTab` over the app's own route table (`router.tsx`), not a copy of it: the
 * handles that make the bar mark Más on Gastos, the expense form and Análisis are
 * the real ones, so deleting one fails here. The "deepest wins" rule is checked on a
 * chain that nests two different tabs.
 */

import { matchRoutes } from 'react-router'
import { expect, test } from 'vitest'
import { router } from '../router'
import { ANALYSIS, EXPENSE_NEW, EXPENSES, MORE } from '../routes'
import { barActiveTab } from './barActiveTab'

function tabOf(path: string): string | undefined {
  const matches = matchRoutes(router.routes, path) ?? []
  return barActiveTab(matches.map((match) => ({ handle: match.route.handle })))
}

test.each([EXPENSES, EXPENSE_NEW, ANALYSIS])('the app marks Más on the bar for %s', (path) => {
  expect(tabOf(path)).toBe('more')
})

test.each(['/', '/ventas', '/clientes', '/varieties', MORE])(
  'the app declares no tab for %s, so the bar falls back to its path',
  (path) => {
    expect(tabOf(path)).toBeUndefined()
  },
)

test('the deepest match that declares a tab wins, not the first', () => {
  expect(
    barActiveTab([
      { handle: { tab: 'outer' } },
      { handle: undefined },
      { handle: { tab: 'inner' } },
    ]),
  ).toBe('inner')
  expect(barActiveTab([{ handle: { tab: 'outer' } }, { handle: { chrome: 'none' } }])).toBe('outer')
})

test('a handle without a string tab declares none', () => {
  expect(
    barActiveTab([{ handle: { tab: 3 } }, { handle: null }, { handle: 'more' }]),
  ).toBeUndefined()
})
