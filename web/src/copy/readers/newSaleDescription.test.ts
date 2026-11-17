/** `describeNewSale`: the bar's + description, built from the records New sale offers. */

import { expect, test } from 'vitest'
import { OTHER_RECORDS } from '../../sales/otherRecords'
import { describeNewSale } from './newSaleDescription'

const EXPENSE_SENTENCE = 'Opens New sale. You can also record an expense from there.'

test('says New sale also records an expense when the expense is offered', () => {
  expect(describeNewSale(['expense'])).toBe(EXPENSE_SENTENCE)
})

test('says nothing when no other record is offered', () => {
  expect(describeNewSale([])).toBeNull()
})

test('takes OTHER_RECORDS as is, so a new record fails to compile until it has its sentence', () => {
  expect(describeNewSale(OTHER_RECORDS)).toBe(EXPENSE_SENTENCE)
})
