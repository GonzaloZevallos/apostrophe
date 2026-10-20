/** The stock entry form, the entries list and the stock withdrawal screens (ADR-0049). The
 * fixed lines that are always on screen (help lines, the preview line and the empty state) are
 * listed in `LIMITED_COPY` for `copy/copyLimits.test.ts`, which measures each with `SAMPLES`
 * (never fixture or API data). The screens render these same bindings. */

import { SAMPLES, type LimitedCopy } from './limits.ts'
import {
  CHOOSE_A_VARIETY,
  DATE_IN_FUTURE_REFUSAL,
  DISCARD_THE_CHANGES,
  OWN_USE,
  PROMOTION,
  WORD_ADD_ANOTHER_VARIETY,
  WORD_DATE,
  WORD_DELETE,
  WORD_EDIT,
  WORD_GRAMS,
  WORD_NOTE,
  WORD_NO_KEEP_EDITING,
  WORD_NO_KEEP_ENTERING,
  WORD_NO_KEEP_IT,
  WORD_TAKE_OUT_OF_STOCK,
  WORD_VARIETY,
  WORD_YES_DELETE_IT,
  WORD_YES_DISCARD_IT,
} from './common.ts'

export const EMPTY_STATE_TITLE = 'No stock entries'
export const EMPTY_STATE_DETAIL = 'Add your opening stock or a purchase'

export const COST_REQUIRED_HELP = 'Required for a purchase'

/** The locked (Onboarding) form's line under the cost: the cost is optional and, left out,
 * the lot costs $ 0 (the entry is posted without `total_cost`). */
export const OPENING_COST_HINT = 'Optional · if you leave it out, the lot costs $ 0'

/** The refusal of a bad grams amount, shared by the price, stock entry and withdrawal forms. */
export const GRAMS_INVALID = 'Check the grams you entered'

/** The refusals of the stock entry form that have a field of their own. */
export const COST_REQUIRED = 'A purchase needs a total cost'
export const COST_ON_NEGATIVE = 'A negative adjustment has no cost'
export const DATE_IN_FUTURE = DATE_IN_FUTURE_REFUSAL

/** The grams on hand under the variety picker; `grams` is already formatted from what
 * the API answered (`formatGrams`), so the registry can measure it with `SAMPLES.grams`. */
export function onHandHelp(grams: string): string {
  return `On hand today: ${grams}`
}

/** The per-gram cost previewed while typing; `perGram` is the front's preview, already
 * formatted (`formatMoney`), so the registry can measure it with `SAMPLES.amount`. */
export function perGramPreview(perGram: string): string {
  return `Works out at ${perGram} a gram`
}

/** The word for a stock entry's origin, shared by every list of entries and the form's pills. */
export const ORIGIN_PURCHASE = 'Purchase'
export const ORIGIN_HARVEST = 'Harvest'
export const ORIGIN_OPENING_STOCK = 'Opening stock'
export const ORIGIN_ADJUSTMENT = 'Adjustment'

/** The two reasons of a stock withdrawal, by their word on screen. */
export const REASON_PROMOTION = PROMOTION
export const REASON_OWN_USE = OWN_USE

/** The words of the icon-only edit and delete controls, and of the form's fields. */
export const EDIT = WORD_EDIT
export const DELETE = WORD_DELETE
export const FIELD_VARIETY = WORD_VARIETY
export const FIELD_GRAMS = WORD_GRAMS
export const FIELD_TOTAL_COST = 'Total cost'
export const FIELD_DATE = WORD_DATE
export const FIELD_ORIGIN = 'Origin'
export const FIELD_NOTE = WORD_NOTE
export const FIELD_REASON = 'Reason'
export const CHOOSE_VARIETY = CHOOSE_A_VARIETY

/** The stock entry screen: its two titles, the two submit buttons and the delete control. */
export const NEW_ENTRY_TITLE = 'New entry'
export const EDIT_ENTRY_TITLE = 'Edit entry'
export const SAVE_ENTRY = 'Save entry'
export const DELETE_ENTRY = 'Delete entry'

/** The entries list: its two titles and the row's cost words. */
export const ALL_ENTRIES_TITLE = 'All entries'
export const ENTRIES_TITLE = 'Entries'
export const NO_COST = 'No cost'
export function costPerGramLine(money: string): string {
  return `${money} per g`
}

/** The confirmation before a delete, shared by the entries list and the entry form. */
export const BEFORE_DELETING = 'Before deleting'
export const YES_DELETE_IT = WORD_YES_DELETE_IT
export const NO_KEEP_IT = WORD_NO_KEEP_IT
export function deleteEntryQuestion(date: string, variety: string, grams: string): string {
  return `Delete the ${date} entry for ${variety}, ${grams}? This can't be undone.`
}

/** The confirmation before saving an edit, and the question when leaving with something typed. */
export const SAVE_CHANGES_TITLE = 'Save the changes?'
export const YES_SAVE = 'Yes, save'
export const NO_KEEP_EDITING = WORD_NO_KEEP_EDITING
export const DISCARD_CHANGES_TITLE = DISCARD_THE_CHANGES
export const DISCARD_ENTRY_TITLE = 'Discard the entry?'
export const DISCARD_ENTRY_DETAIL = "You'll lose what you entered: nothing has been saved yet."
export const YES_DISCARD_IT = WORD_YES_DISCARD_IT
export const NO_KEEP_ENTERING = WORD_NO_KEEP_ENTERING
export const SAVE_ENTRY_DETAIL = 'This updates the entry.'

/** The stock withdrawal screens: the form, the detail and the confirmations. */
export const TAKE_OUT_OF_STOCK = WORD_TAKE_OUT_OF_STOCK
export const WITHDRAWAL_TITLE = 'Withdrawal'
export const SAVE_WITHDRAWAL = 'Save withdrawal'
export const SAVE_WITHDRAWAL_DETAIL = 'This updates the withdrawal and the lots that come after it.'
export const ADD_ANOTHER_VARIETY = WORD_ADD_ANOTHER_VARIETY
export const WITHDRAWAL_SAVED = 'Withdrawal saved'
export const WITHDRAWAL_DELETED = 'Withdrawal deleted'
export const DISCARD_WITHDRAWAL_TITLE = 'Discard the withdrawal?'
export const DISCARD_WITHDRAWAL_EDIT_DETAIL = "You'll lose what you changed: the withdrawal stays as it was."
export const varietyAndGrams = (position: number | null) =>
  position === null ? 'Variety and grams' : `Variety and grams ${position}`
export const varietyLine = (position: number) => `Variety ${position}`
export const gramsLine = (position: number) => `Grams ${position}`
export const removeVarietyLine = (position: number) => `Remove variety ${position}`
export function deleteWithdrawalQuestion(promotion: boolean, date: string, grams: string): string {
  const what = promotion ? 'promotion' : 'own-use withdrawal'
  return `Delete the ${what} of ${date}? ${grams} will go back to stock.`
}

/** Checked by `copy/copyLimits.test.ts`: placeholders filled from `SAMPLES`. */
export const LIMITED_COPY: readonly LimitedCopy[] = [
  { kind: 'emptyTitle', text: EMPTY_STATE_TITLE },
  { kind: 'emptyLine', text: EMPTY_STATE_DETAIL },
  { kind: 'help', text: COST_REQUIRED_HELP },
  { kind: 'help', text: OPENING_COST_HINT },
  { kind: 'help', text: GRAMS_INVALID },
  { kind: 'help', text: onHandHelp(SAMPLES.grams) },
  { kind: 'help', text: perGramPreview(SAMPLES.amount) },
]
export const LONG_REFUSALS: readonly string[] = []
