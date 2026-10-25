/**
 * The fixed copy of `Estados` ("Offline" and the generic server-error retry), registered
 * for `copy/copyLimits.test.ts`. `SinConexion` and `ErrorGenerico` render these same
 * bindings. "Offline" is one sentence and promises no automatic retry: the app performs
 * none (`queryClient.ts`).
 */

import { baselineArgs, FIXTURE } from './baselineArgs.ts'
import type * as Self from './common.ts'
import type { LimitedCopy } from './limits.ts'

export const LANGUAGE: 'es' | 'en' = 'en'

export const SIN_CONEXION_MENSAJE = 'Offline: check your internet and try again.'
export const ERROR_GENERICO_MENSAJE = 'Something went wrong. Try again.'

export const LIMITED_COPY: readonly LimitedCopy[] = [
  { kind: 'notice', text: SIN_CONEXION_MENSAJE },
  { kind: 'notice', text: ERROR_GENERICO_MENSAJE },
]
export const LONG_REFUSALS: readonly string[] = []


const { money: M, date: D } = FIXTURE

/** The fixture arguments of this file's functions, for `en.baseline.json` (`./baselineArgs.ts`). */
export const BASELINE_ARGS = baselineArgs<typeof Self>()({
  'COMMON_TEXT.settingsFor': [['Rosa Flowers']],
  'COMMON_TEXT.pricePerGram': [[M]],
  'COMMON_TEXT.collectFrom': [['Ana']],
  'COMMON_TEXT.todayWith': [[D]],
  'COMMON_TEXT.returnsTo': [[M, D]],
  'COMMON_TEXT.noPriceBefore': [[D]],
  'COMMON_TEXT.backArrow': [['Customers']],
})

/** Every text a person reads in this area that is not a named message above, by key. */
export const COMMON_TEXT = {
  flowerPurchases: 'Flower purchases',
  catalog: 'Catalog',
  editCustomer: 'Edit customer',
  phoneOrName: 'Phone or name',
  addExpense: 'Add expense',
  home: 'Home',
  done: 'Done',
  noKeepTyping: 'No, keep typing',
  yesDiscard: 'Yes, discard it',
  more: 'More',
  discardTheChange: 'Discard the change?',
  newVariety: 'New variety',
  newPrice: 'New price',
  entries: 'Entries',
  stockEntry: 'Stock entry',
  archived: 'Archived',
  withdrawal: 'Withdrawal',
  warningOff: 'Warning off',
  backTo: 'Back to ',
  loading: 'Loading',
  moreInfo: 'More info',
  hide: 'Hide',
  show: 'Show',
  howPaid: 'How it was paid',
  previousMonth: 'Previous month',
  nextMonth: 'Next month',
  soldSuffix: ' sold',
  variety: 'Variety',
  sales: 'Sales',
  grams: 'Grams',
  expenses: 'Expenses',
  profit: 'Profit',
  cash: 'Cash',
  changePassword: 'Change password',
  save: 'Save',
  share: 'Share',
  copy: 'Copy',
  varieties: 'Varieties',
  close: 'Close',
  discardTheChanges: 'Discard the changes?',
  losesWhatYouEntered: 'What you entered is lost: nothing has been saved yet.',
  noKeepEntering: 'No, keep entering',
  allEntries: 'All entries',
  perGram: ' x g',
  edit: 'Edit',
  yesDelete: 'Yes, delete it',
  noKeep: 'No, keep it',
  noKeepEditing: 'No, keep editing',
  settingsFor: (business_name: string | number) => `Settings for ${business_name}`,
  businessName: 'Business name',
  date: 'Date',
  pickAVariety: 'Pick a variety',
  note: 'Note',
  takeFromStock: 'Take from stock',
  pricePerGram: (list_price: string | number) => `${list_price} x g`,
  customers: 'Customers',
  recordPayment: 'Record payment',
  vip: 'VIP',
  cannotUndo: "This can't be undone.",
  collectFrom: (name: string | number) => `Collect from ${name}`,
  collect: 'Collect',
  newCustomer: 'New customer',
  amount: 'Amount',
  name: 'Name',
  owedToYou: 'Owed to you',
  category: 'Category',
  period: 'Period',
  addAnotherVariety: 'Add another variety',
  saveTheName: 'Save the name',
  change: 'Change',
  bulkPrice: 'Bulk price',
  newSale: 'New sale',
  cashMethod: 'Cash',
  transfer: 'Transfer',
  owing: 'Owing',
  customerSaved: 'Customer saved',
  saleDeleted: 'Sale deleted',
  saleDeletedGramsBack: 'Sale deleted · the grams go back to stock',
  entrySaved: 'Entry saved',
  entryDeleted: 'Entry deleted',
  saleSaved: 'Sale saved',
  todayWith: (iso: string | number) => `Today ${iso}`,
  prices: 'Prices',
  analysis: 'Analysis',
  settings: 'Settings',
  business: 'Business',
  users: 'Users',
  catalogMessage: 'Catalog message',
  expenseCategories: 'Expense categories',
  appearance: 'Appearance',
  yourAccount: 'Your account',
  varietyWithPrice: 'Variety with price',
  initialStock: 'Initial stock',
  telegramBot: 'Telegram bot',
  partner: 'Partner',
  dateCannotBeFuture: 'The date cannot be in the future',
  purchase: 'Purchase',
  harvest: 'Harvest',
  adjustment: 'Adjustment',
  nameTooLong: 'The name is too long',
  today: 'Today',
  week: 'Week',
  month: 'Month',
  returnsTo: (list_price: string | number, effective_from: string | number) => `Back to ${list_price} x g from ${effective_from}`,
  noPriceBefore: (effective_from: string | number) => `There will be no price before ${effective_from}`,
  cancel: 'Cancel',
  backArrow: (parent: string | number) => `‹ ${parent}`,
} as const
