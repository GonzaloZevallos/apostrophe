/**
 * The fixed help line of Gastos, registered for `copy/copyLimits.test.ts`. `Gastos.tsx`
 * renders this same binding.
 */

import { baselineArgs, FIXTURE } from './baselineArgs.ts'
import type * as Self from './expenses.ts'
import { STOCK_TEXT } from './stock.ts'
import type { LimitedCopy } from './limits.ts'

export const LANGUAGE: 'es' | 'en' = 'en'

export const FLOWER_NOTICE = "Flower purchases don't go here: enter them in Stock."

export const LIMITED_COPY: readonly LimitedCopy[] = [{ kind: 'help', text: FLOWER_NOTICE }]
export const LONG_REFUSALS: readonly string[] = []


const { money: M, date: D } = FIXTURE

/** The fixture arguments of this file's functions, for `en.baseline.json` (`./baselineArgs.ts`). */
export const BASELINE_ARGS = baselineArgs<typeof Self>()({
  'EXPENSES_TEXT.expenseMany': [[0], [1], [2]],
  'EXPENSES_TEXT.expenseCountIn': [[M, '3 categories']],
  'EXPENSES_TEXT.deleteTheExpenseOf': [[M, 'Rent', D]],
  'EXPENSES_TEXT.categoriesCount': [[0], [1], [2]],
  'EXPENSES_TEXT.youSpentIn': [['November 2026']],
  'EXPENSES_TEXT.barLabel': [['Rent 70%, Others 30%']],
  'EXPENSES_TEXT.barSegment': [['Rent', 70]],
})

/** Every text a person reads in this area that is not a named message above, by key. */
export const EXPENSES_TEXT = {
  expenseOne: '1 expense',
  expenseMany: (expenses: number) => `${expenses} expenses`,
  expenseCountIn: (spent: string, inCategories: string) => `${spent} in ${inCategories}`,
  deleteTheExpense: 'Delete the expense?',
  thisCannotBeUndone: " This can't be undone.",
  youSpentThisMonth: 'You spent this month',
  byCategory: 'By category',
  latest: 'Latest',
  categories: 'Categories',
  whatYouChangedIsLost: 'What you changed is lost: the expense stays as it was.',
  yesDiscardThem: 'Yes, discard them',
  editExpense: 'Edit expense',
  pickACategory: 'Pick a category',
  newCategoryName: 'New category name',
  createCategory: 'Create category',
  createANewCategory: 'Create a new category',
  deleteExpense: 'Delete expense',
  discardTheExpense: 'Discard the expense?',
  saleStaysAsItIs: 'Your sale in progress stays as it is.',
  deleteTheExpenseOf: (amount: string | number, categoryName: string | number, date: string | number) => `Delete the expense of ${amount} in ${categoryName} on ${date}?`,
  oneCategory: '1 category',
  categoriesCount: (categories: string | number) => `${categories} categories`,
  expenseDeleted: 'Expense deleted',
  categoryGone: 'That category is gone. Pick another.',
  expenseSaved: 'Expense saved',
  youSpentIn: (month: string) => `You spent in ${month}`,
  others: 'Others',
  thousandSuffix: 'k',
  millionSuffix: 'M',
  barLabel: (segments: string) => `Spending by category: ${segments}`,
  barSegment: (name: string, percent: string | number) => `${name} ${percent}%`,
  today: 'today',
  /** Short weekdays, index 0 = Monday (the order `relativeDay` returns). */
  weekdaysShort: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  delete: STOCK_TEXT.borrar,
} as const
