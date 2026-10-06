/**
 * `activeTab(pathname)` at its own seam: a table over every path `paths` builds, ids
 * included, so a route added to `paths` without a tab (or a deliberate `null`) fails
 * here instead of lighting nothing in the bar.
 */

import { expect, test } from 'vitest'
import { paths } from '../routes/paths'
import { activeTab, barTab, type Tab } from './activeTab'

const TABLE: [string, Tab | null][] = [
  [paths.home(), 'home'],
  [paths.sales(), 'sales'],
  [paths.newSale(), 'sales'],
  [paths.sale(7), 'sales'],
  [paths.customers(), 'customers'],
  [paths.newCustomer(), 'customers'],
  [paths.customer(7), 'customers'],
  [paths.editCustomer(7), 'customers'],
  [paths.customersOwing(), 'customers'],
  [paths.varieties(), 'varieties'],
  [paths.variety(7), 'varieties'],
  [paths.catalog(), 'varieties'],
  [paths.entries(), 'varieties'],
  [paths.newEntry(), 'varieties'],
  [paths.entry(7), 'varieties'],
  [paths.expenses(), 'expenses'],
  [paths.newExpense(), 'expenses'],
  [paths.analysis(), 'analysis'],
  [paths.more(), 'more'],
  [paths.settings(), 'more'],
  [paths.settingsBusiness(), 'more'],
  [paths.settingsUsers(), 'more'],
  [paths.settingsAccount(), 'more'],
  [paths.expenseCategories(), 'more'],
  [paths.settingsIntegrations(), 'more'],
  [paths.settingsCatalogMessage(), 'more'],
  // Public screens carry no tab.
  [paths.login(), null],
  [paths.invitation('abc'), null],
  [paths.reset('abc'), null],
  ['/nowhere', null],
]

test.each(TABLE)('%s marks %s', (pathname, expected) => {
  expect(activeTab(pathname)).toBe(expected)
})

test('a segment that only starts like a tab does not mark it', () => {
  expect(activeTab('/salesman')).toBeNull()
  expect(activeTab('/settingsx')).toBeNull()
})

test('the phone bar marks Más on Gastos and Análisis; every path lights one bar tab', () => {
  expect(barTab(activeTab(paths.expenses()))).toBe('more')
  expect(barTab(activeTab(paths.newExpense()))).toBe('more')
  expect(barTab(activeTab(paths.analysis()))).toBe('more')
  expect(barTab(activeTab(paths.settings()))).toBe('more')
  expect(barTab(activeTab(paths.sales()))).toBe('sales')
  expect(barTab(activeTab('/nowhere'))).toBeNull()
  for (const [pathname, tab] of TABLE) {
    if (tab !== null) expect(['home', 'sales', 'customers', 'varieties', 'more']).toContain(barTab(activeTab(pathname)))
  }
})

test('the sidebar still marks Gastos and Análisis on their own', () => {
  expect(activeTab(paths.expenses())).toBe('expenses')
  expect(activeTab(paths.analysis())).toBe('analysis')
})
