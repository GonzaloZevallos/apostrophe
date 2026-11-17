/** The pure rule of New sale's one leave question: what it asks and what it says under it. */

import { expect, test } from 'vitest'
import { COMMON_TEXT } from '../../copy/common'
import { EXPENSES_TEXT } from '../../copy/expenses'
import { SALES_TEXT } from '../../copy/sales'
import { leaveQuestion } from './leaveQuestion'

const EXPENSE = EXPENSES_TEXT.discardTheExpense
const SALE = SALES_TEXT.discardSale

const table: { touched: boolean; strip: boolean; onlySheet: boolean; question: string; detail: string }[] = [
  { touched: true, strip: true, onlySheet: true, question: EXPENSE, detail: EXPENSES_TEXT.saleStaysAsItIs },
  { touched: true, strip: false, onlySheet: true, question: EXPENSE, detail: COMMON_TEXT.losesWhatYouEntered },
  { touched: false, strip: true, onlySheet: true, question: EXPENSE, detail: EXPENSES_TEXT.saleStaysAsItIs },
  { touched: false, strip: false, onlySheet: true, question: EXPENSE, detail: COMMON_TEXT.losesWhatYouEntered },
  { touched: true, strip: true, onlySheet: false, question: SALE, detail: SALES_TEXT.cannotRecover },
  { touched: true, strip: false, onlySheet: false, question: SALE, detail: SALES_TEXT.cannotRecover },
  { touched: false, strip: true, onlySheet: false, question: EXPENSE, detail: EXPENSES_TEXT.saleStaysAsItIs },
  { touched: false, strip: false, onlySheet: false, question: EXPENSE, detail: COMMON_TEXT.losesWhatYouEntered },
]

test.each(table)(
  'touched $touched, strip $strip, only the Sheet $onlySheet asks "$question"',
  ({ touched, strip, onlySheet, question, detail }) => {
    expect(leaveQuestion({ touched, strip, onlySheet })).toEqual({ question, detail })
  },
)

test('the new sentence is the one the PRD names', () => {
  expect(EXPENSES_TEXT.saleStaysAsItIs).toBe('Your sale in progress stays as it is.')
})
