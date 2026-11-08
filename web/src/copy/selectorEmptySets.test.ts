import { expect, test } from 'vitest'
import common from './locales/en/common.json'
import emptyStates from './locales/en/emptyStates.json'

// Each empty-set message names the place where that set's options are created; the place
// names are the section titles the screens show, so a renamed section fails here.
test('the varieties message cites the Varieties tab title', () => {
  expect(emptyStates.selectorNoVarieties).toContain(common.varieties)
})

test('the categories message cites Settings and Expense categories', () => {
  expect(emptyStates.selectorNoCategories).toContain(common.settings)
  expect(emptyStates.selectorNoCategories).toContain(common.expenseCategories)
})

test('the reasons message cites Settings, Business and Withdrawal reasons', () => {
  expect(emptyStates.selectorNoReasons).toContain(common.settings)
  expect(emptyStates.selectorNoReasons).toContain(common.business)
  expect(emptyStates.selectorNoReasons).toContain(common.withdrawalReasons)
})

test('a message that cites a place that is not its title is rejected', () => {
  expect('No reasons yet. Add them in Settings → Somewhere else.').not.toContain(common.withdrawalReasons)
})
