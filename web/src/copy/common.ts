/**
 * The fixed copy of `Estados` ("Offline" and the generic server-error retry), registered
 * for `copy/copyLimits.test.ts`. `SinConexion` and `ErrorGenerico` render these same
 * bindings. "Offline" is one sentence and promises no automatic retry: the app performs
 * none (`queryClient.ts`).
 *
 * The texts live in `locales/en/common.json` (ADR-0050). `COMMON_TEXT` and the two messages
 * below stay, English words unchanged and `@deprecated`, until their last reader moves to the
 * key; `common.deprecated.test.ts` keeps each equal to its key. Delete them with the last reader.
 */

import { baselineArgs, FIXTURE } from './baselineArgs.ts'
import type * as Self from './common.ts'
import type { KeyedCopy } from './limits.ts'

export const LANGUAGE: 'es' | 'en' = 'en'
export const NAMESPACE = 'common'

/** The exports below that are moved to keys and kept only for their readers. */
export const MOVED_TO_KEYS = ['COMMON_TEXT', 'SIN_CONEXION_MENSAJE', 'ERROR_GENERICO_MENSAJE'] as const

/** @deprecated read `common:offline` */
export const SIN_CONEXION_MENSAJE = 'Offline: check your internet and try again.'
/** @deprecated read `common:genericError` */
export const ERROR_GENERICO_MENSAJE = 'Something went wrong. Try again.'

export const LIMITED_COPY: readonly KeyedCopy[] = [
  { kind: 'notice', key: 'common:offline' },
  { kind: 'notice', key: 'common:genericError' },
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

/**
 * Every text a person reads in this area that is not a named message above, by key.
 * Each entry is `@deprecated`: read the `common:` key of the same name instead (`backTo`,
 * `soldSuffix` and `perGram` are fragments: `common:backTo`, `common:gramsSold` and
 * `common:pricePerGram` take the part the caller used to concatenate).
 */
export const COMMON_TEXT = {
  /** @deprecated read `common:flowerPurchases` */
  flowerPurchases: 'Flower purchases',
  /** @deprecated read `common:catalog` */
  catalog: 'Catalog',
  /** @deprecated read `common:editCustomer` */
  editCustomer: 'Edit customer',
  /** @deprecated read `common:phoneOrName` */
  phoneOrName: 'Phone or name',
  /** @deprecated read `common:addExpense` */
  addExpense: 'Add expense',
  /** @deprecated read `common:home` */
  home: 'Home',
  /** @deprecated read `common:done` */
  done: 'Done',
  /** @deprecated read `common:noKeepTyping` */
  noKeepTyping: 'No, keep typing',
  /** @deprecated read `common:yesDiscard` */
  yesDiscard: 'Yes, discard it',
  /** @deprecated read `common:more` */
  more: 'More',
  /** @deprecated read `common:discardTheChange` */
  discardTheChange: 'Discard the change?',
  /** @deprecated read `common:newVariety` */
  newVariety: 'New variety',
  /** @deprecated read `common:newPrice` */
  newPrice: 'New price',
  /** @deprecated read `common:entries` */
  entries: 'Entries',
  /** @deprecated read `common:stockEntry` */
  stockEntry: 'Stock entry',
  /** @deprecated read `common:archived` */
  archived: 'Archived',
  /** @deprecated read `common:withdrawal` */
  withdrawal: 'Withdrawal',
  /** @deprecated read `common:warningOff` */
  warningOff: 'Warning off',
  /** @deprecated read `common:backTo` with `{ parent }` */
  backTo: 'Back to ',
  /** @deprecated read `common:loading` */
  loading: 'Loading',
  /** @deprecated read `common:moreInfo` */
  moreInfo: 'More info',
  /** @deprecated read `common:hide` */
  hide: 'Hide',
  /** @deprecated read `common:show` */
  show: 'Show',
  /** @deprecated read `common:howPaid` */
  howPaid: 'How it was paid',
  /** @deprecated read `common:previousMonth` */
  previousMonth: 'Previous month',
  /** @deprecated read `common:nextMonth` */
  nextMonth: 'Next month',
  /** @deprecated read `common:gramsSold` with `{ grams }` */
  soldSuffix: ' sold',
  /** @deprecated read `common:variety` */
  variety: 'Variety',
  /** @deprecated read `common:sales` */
  sales: 'Sales',
  /** @deprecated read `common:grams` */
  grams: 'Grams',
  /** @deprecated read `common:expenses` */
  expenses: 'Expenses',
  /** @deprecated read `common:profit` */
  profit: 'Profit',
  /** @deprecated read `common:cash` */
  cash: 'Cash',
  /** @deprecated read `common:changePassword` */
  changePassword: 'Change password',
  /** @deprecated read `common:save` */
  save: 'Save',
  /** @deprecated read `common:share` */
  share: 'Share',
  /** @deprecated read `common:copy` */
  copy: 'Copy',
  /** @deprecated read `common:varieties` */
  varieties: 'Varieties',
  /** @deprecated read `common:close` */
  close: 'Close',
  /** @deprecated read `common:discardTheChanges` */
  discardTheChanges: 'Discard the changes?',
  /** @deprecated read `common:losesWhatYouEntered` */
  losesWhatYouEntered: 'What you entered is lost: nothing has been saved yet.',
  /** @deprecated read `common:noKeepEntering` */
  noKeepEntering: 'No, keep entering',
  /** @deprecated read `common:allEntries` */
  allEntries: 'All entries',
  /** @deprecated read `common:pricePerGram` with `{ amount }` */
  perGram: ' x g',
  /** @deprecated read `common:edit` */
  edit: 'Edit',
  /** @deprecated read `common:yesDelete` */
  yesDelete: 'Yes, delete it',
  /** @deprecated read `common:noKeep` */
  noKeep: 'No, keep it',
  /** @deprecated read `common:noKeepEditing` */
  noKeepEditing: 'No, keep editing',
  /** @deprecated read `common:settingsFor` */
  settingsFor: (business: string | number) => `Settings for ${business}`,
  /** @deprecated read `common:businessName` */
  businessName: 'Business name',
  /** @deprecated read `common:date` */
  date: 'Date',
  /** @deprecated read `common:pickAVariety` */
  pickAVariety: 'Pick a variety',
  /** @deprecated read `common:note` */
  note: 'Note',
  /** @deprecated read `common:takeFromStock` */
  takeFromStock: 'Take from stock',
  /** @deprecated read `common:pricePerGram` */
  pricePerGram: (amount: string | number) => `${amount} x g`,
  /** @deprecated read `common:customers` */
  customers: 'Customers',
  /** @deprecated read `common:recordPayment` */
  recordPayment: 'Record payment',
  /** @deprecated read `common:vip` */
  vip: 'VIP',
  /** @deprecated read `common:cannotUndo` */
  cannotUndo: "This can't be undone.",
  /** @deprecated read `common:collectFrom` */
  collectFrom: (customer: string | number) => `Collect from ${customer}`,
  /** @deprecated read `common:collect` */
  collect: 'Collect',
  /** @deprecated read `common:newCustomer` */
  newCustomer: 'New customer',
  /** @deprecated read `common:amount` */
  amount: 'Amount',
  /** @deprecated read `common:name` */
  name: 'Name',
  /** @deprecated read `common:owedToYou` */
  owedToYou: 'Owed to you',
  /** @deprecated read `common:category` */
  category: 'Category',
  /** @deprecated read `common:period` */
  period: 'Period',
  /** @deprecated read `common:addAnotherVariety` */
  addAnotherVariety: 'Add another variety',
  /** @deprecated read `common:saveTheName` */
  saveTheName: 'Save the name',
  /** @deprecated read `common:change` */
  change: 'Change',
  /** @deprecated read `common:bulkPrice` */
  bulkPrice: 'Bulk price',
  /** @deprecated read `common:newSale` */
  newSale: 'New sale',
  /** @deprecated read `common:cashMethod` */
  cashMethod: 'Cash',
  /** @deprecated read `common:transfer` */
  transfer: 'Transfer',
  /** @deprecated read `common:owing` */
  owing: 'Owing',
  /** @deprecated read `common:customerSaved` */
  customerSaved: 'Customer saved',
  /** @deprecated read `common:saleDeleted` */
  saleDeleted: 'Sale deleted',
  /** @deprecated read `common:saleDeletedGramsBack` */
  saleDeletedGramsBack: 'Sale deleted · the grams go back to stock',
  /** @deprecated read `common:entrySaved` */
  entrySaved: 'Entry saved',
  /** @deprecated read `common:entryDeleted` */
  entryDeleted: 'Entry deleted',
  /** @deprecated read `common:saleSaved` */
  saleSaved: 'Sale saved',
  /** @deprecated read `common:todayWith` */
  todayWith: (date: string | number) => `Today ${date}`,
  /** @deprecated read `common:prices` */
  prices: 'Prices',
  /** @deprecated read `common:analysis` */
  analysis: 'Analysis',
  /** @deprecated read `common:settings` */
  settings: 'Settings',
  /** @deprecated read `common:business` */
  business: 'Business',
  /** @deprecated read `common:users` */
  users: 'Users',
  /** @deprecated read `common:catalogMessage` */
  catalogMessage: 'Catalog message',
  /** @deprecated read `common:expenseCategories` */
  expenseCategories: 'Expense categories',
  /** @deprecated read `common:appearance` */
  appearance: 'Appearance',
  /** @deprecated read `common:yourAccount` */
  yourAccount: 'Your account',
  /** @deprecated read `common:varietyWithPrice` */
  varietyWithPrice: 'Variety with price',
  /** @deprecated read `common:initialStock` */
  initialStock: 'Initial stock',
  /** @deprecated read `common:telegramBot` */
  telegramBot: 'Telegram bot',
  /** @deprecated read `common:partner` */
  partner: 'Partner',
  /** @deprecated read `common:dateCannotBeFuture` */
  dateCannotBeFuture: 'The date cannot be in the future',
  /** @deprecated read `common:purchase` */
  purchase: 'Purchase',
  /** @deprecated read `common:harvest` */
  harvest: 'Harvest',
  /** @deprecated read `common:adjustment` */
  adjustment: 'Adjustment',
  /** @deprecated read `common:nameTooLong` */
  nameTooLong: 'The name is too long',
  /** @deprecated read `common:today` */
  today: 'Today',
  /** @deprecated read `common:week` */
  week: 'Week',
  /** @deprecated read `common:month` */
  month: 'Month',
  /** @deprecated read `common:returnsTo` */
  returnsTo: (amount: string | number, date: string | number) => `Back to ${amount} x g from ${date}`,
  /** @deprecated read `common:noPriceBefore` */
  noPriceBefore: (date: string | number) => `There will be no price before ${date}`,
  /** @deprecated read `common:cancel` */
  cancel: 'Cancel',
  /** @deprecated read `common:backArrow` */
  backArrow: (parent: string | number) => `‹ ${parent}`,
} as const
