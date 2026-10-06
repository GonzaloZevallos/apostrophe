/**
 * `activeTab(pathname)` at its own seam: a table over every path `paths` builds, ids
 * included, so a route added to `paths` without a tab (or a deliberate `null`) fails
 * here instead of lighting nothing in the bar.
 */

import { expect, test } from 'vitest'
import { paths } from '../routes/paths'
import { activeTab, type Tab } from './activeTab'

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
