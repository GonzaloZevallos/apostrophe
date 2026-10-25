/**
 * The fixed help line of Gastos, registered for `copy/copyLimits.test.ts`. `Gastos.tsx`
 * renders this same binding.
 */

import { baselineArgs } from './baselineArgs.ts'
import type * as Self from './expenses.ts'
import type { LimitedCopy } from './limits'

export const LANGUAGE: 'es' | 'en' = 'en'

export const FLOWER_NOTICE = "Flower purchases don't go here: enter them in Stock."

export const LIMITED_COPY: readonly LimitedCopy[] = [{ kind: 'help', text: FLOWER_NOTICE }]
export const LONG_REFUSALS: readonly string[] = []

const M = '$ 11.000'
const D = '28/09'

/** The fixture arguments of this file's functions, for `en.baseline.json` (`./baselineArgs.ts`). */
export const BASELINE_ARGS = baselineArgs<typeof Self>()({
  'EXPENSES_TEXT.expenseMany': [[0], [1], [2]],
  'EXPENSES_TEXT.expenseCountIn': [[M, '3 categories']],
  'EXPENSES_TEXT.deleteTheExpenseOf': [[M, 'Rent', D]],
  'EXPENSES_TEXT.categoriesCount': [[0], [1], [2]],
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
  details: 'Details',
  saveTheExpense: 'Save the expense',
  deleteExpense: 'Delete expense',
  discardTheExpense: 'Discard the expense?',
  moreScreen: 'More screen',
  addExpenseFromMore: 'Add expense from More',
  deleteTheExpenseOf: (amount: string | number, categoryName: string | number, date: string | number) => `Delete the expense of ${amount} in ${categoryName} on ${date}?`,
  oneCategory: '1 category',
  categoriesCount: (categories: string | number) => `${categories} categories`,
  expenseDeleted: 'Expense deleted',
  categoryGone: 'That category is gone. Pick another.',
  expenseSaved: 'Expense saved',
} as const
