/**
 * The fixed help line of Gastos, registered for `copy/copyLimits.test.ts`. `Gastos.tsx`
 * renders this same binding.
 */

import type { LimitedCopy } from './limits'

export const FLOWER_NOTICE = "Flower purchases don't go here: enter them in Stock."

/** Gastos: the header, the month's figures, the list and the delete question. */
export const ADD_EXPENSE = 'Add expense'
export const SPENT_THIS_MONTH = 'You spent this month'
export const BY_CATEGORY = 'By category'
export const LATEST = 'Latest'
export const CATEGORIES = 'Categories'
export const countLine = (expenses: number, categories: number) =>
  `${expenses === 1 ? '1 expense' : `${expenses} expenses`} in ${categories === 1 ? '1 category' : `${categories} categories`}`

export const DELETE_TITLE = 'Delete the expense?'
export const deleteQuestion = (amount: string, category: string, date: string) =>
  `Delete the ${amount} expense in ${category} from ${date}?`
export const CANNOT_UNDO = "This can't be undone."
export const NO_DISCARD_TITLE = 'No, keep it'
export const YES_DELETE_TITLE = 'Yes, delete it'
export const EXPENSE_DELETED = 'Expense deleted'
export const EXPENSE_SAVED = 'Expense saved'

export const DISCARD_CHANGES_TITLE = 'Discard the changes?'
export const DISCARD_CHANGES_DETAIL = 'You lose what you changed: the expense stays as it was.'
export const DISCARD_CHANGES_CONFIRM = 'Yes, discard them'
export const DISCARD_CHANGES_CANCEL = 'No, keep editing'

export const DISCARD_NEW_TITLE = 'Discard the expense?'
export const DISCARD_NEW_DETAIL = 'You lose what you entered: nothing has been saved yet.'
export const DISCARD_NEW_CANCEL = 'No, keep entering'
export const DISCARD_NEW_CONFIRM = 'Yes, discard it'

/** The expense form. */
export const CATEGORY_GONE = 'That category is gone. Pick another.'
export const FORM_TITLE_NEW = 'Add expense'
export const FORM_TITLE_EDIT = 'Edit expense'
export const FIELD_DATE = 'Date'
export const FIELD_CATEGORY = 'Category'
export const PICK_CATEGORY = 'Pick a category'
export const NEW_CATEGORY_NAME = 'New category name'
export const CREATE_CATEGORY = 'Create category'
export const CREATE_NEW_CATEGORY = 'Create a new category'
export const FIELD_AMOUNT = 'Amount'
export const FIELD_DETAIL = 'Detail'
export const SAVE_EXPENSE = 'Save expense'
export const DELETE_EXPENSE = 'Delete expense'

/** More: each entry's label and subtitle. */
export const MORE_TAKE_OUT = 'Take out of stock'
export const MORE_SETTINGS = 'Settings'
export const MORE_ADD_EXPENSE_DETAIL = 'Category, amount and detail'
export const MORE_TAKE_OUT_DETAIL = 'Promotion or own use'
export const MORE_EXPENSES_DETAIL = 'By month and by category'
export const MORE_ANALYSIS_DETAIL = 'Varieties, weeks, months and days'
export const MORE_SETTINGS_DETAIL =
  'Business, users, bot, catalog, categories, appearance and your account'

export const LIMITED_COPY: readonly LimitedCopy[] = [{ kind: 'help', text: FLOWER_NOTICE }]
export const LONG_REFUSALS: readonly string[] = []
