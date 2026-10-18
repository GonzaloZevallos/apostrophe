/** The fixed English of the varieties list, Archived, a variety's page and its forms (the
 * name, the low-stock warning, the catalog attributes and the removal), the whole price
 * history and the price form: the titles, the empty states and the help lines always on
 * screen, the toasts (`PRICE_SAVED`, `THRESHOLD_SAVED`... which `AvisoExito` types on) and the
 * one table from a refusal of `PUT /stock/varieties/{id}/threshold` to its message. Each
 * always-visible line is a binding the screen renders, listed in `LIMITED_COPY` with its kind
 * (`copy/copyLimits.test.ts` measures it). */

import type { RefusalCode } from '../api/refusals'
import type { SuccessToast } from '../components/AvisoExito'
import type { LimitedCopy } from './limits'

export const EMPTY_TITLE = "You haven't added any varieties yet"
export const EMPTY_DETAIL = 'Add the first one with its price so you can sell and send your catalog.'
export const NO_ARCHIVED_MESSAGE = 'You have no archived varieties'
export const PRICE_HISTORY_HELP = 'Each sale uses the price in force that day, even if you change it later.'
/** Why "Send catalog" is disabled, only while the first-run checklist shows and nothing qualifies. */
export const CATALOG_DISABLED_REASON = 'Add a variety with a price and stock'

export const PRICE_PER_GRAM_HELP = 'Per gram, in whole pesos'
export const PRICE_DISCOUNT_HELP = 'Optional · lower than the list price'
export const PRICE_FROM_GRAMS_HELP = 'From how many grams it applies'
export const VARIETY_NAME_HELP = "Up to 60 characters · can't repeat another variety's name"

/** The list (`Variedades`) and Archived. */
export const SEND_CATALOG = 'Send catalog'
export const STOCK_ENTRY = 'Stock entry'
export const STOCK_ENTRY_ACCESSIBLE_NAME = '+ Stock entry'
export const NEW_VARIETY = 'New variety'
export const HIDDEN = 'Hidden'
export const ARCHIVED = 'Archived'
export const archivedCount = (count: number) => `Archived (${count})`
export const RESTORE = 'Restore'
/** "$ 11.000 x g": the list price in force, the amount already formatted. */
export const pricePerGram = (price: string) => `${price} x g`
export const NO_PRICE_TODAY = "No price: can't be sold"

/** The toasts and the refusal lines of a variety's name and of its forms. */
export const VARIETY_SAVED = 'Variety saved'
export const VARIETY_DELETED = 'Variety deleted'
export const VARIETY_ARCHIVED = 'Variety archived'
export const VARIETY_RESTORED = 'Variety restored'
export const NAME_TAKEN_MESSAGE = 'A variety with that name already exists'
export const NAME_INVALID_MESSAGE = 'Give the variety a name, without extra spaces'
export const EMOJI_INVALID_MESSAGE = 'Enter exactly one emoji'
export const INDICA_SHARE_INVALID_MESSAGE = 'The indica percentage goes from 0 to 100'
export const AROMA_TOO_LONG_MESSAGE = 'The aroma is too long'
export const DUPLICATE_DATE_MESSAGE = 'You already added a price with that date'
export const PRICE_INVALID_MESSAGE = 'Check the prices you entered'

/** A toast, not always-visible copy, so it is not in `LIMITED_COPY`. */
export const PRICE_SAVED = 'Price saved'
export const PRICE_DELETED = 'Price deleted'
export const CATALOG_ATTRIBUTES_SAVED: SuccessToast = 'Catalog saved'

export const THRESHOLD_INVALID_MESSAGE = 'Check the threshold you entered'
export const THRESHOLD_SAVED: SuccessToast = 'Warning saved'

export const THRESHOLD_OVERRIDES: Partial<Record<RefusalCode, string>> = {
  'stock.threshold_invalid': THRESHOLD_INVALID_MESSAGE,
}

/** A variety's page: the actions and the sections' titles. */
export const EDIT_NAME = 'Edit name'
export const ENTRY = 'Entry'
export const ENTRY_ACCESSIBLE_NAME = '+ Entry'
export const NEW_PRICE = 'New price'
export const SEE_ALL = 'See all'
export const STOCK_AND_ENTRIES = 'Stock and entries'
export const perGram = (cost: string) => `${cost} per gram`
export const PRICES = 'Prices'
export const LOW_STOCK_WARNING = 'Low-stock warning'
export const EDIT_WARNING = 'Edit warning'
export const WARN_WHEN_LOW = 'Warn when stock is low'
export const WARN_BELOW = 'Warn below'

/** The forms. */
export const RENAME_VARIETY = 'Rename variety'
export const NAME = 'Name'
export const VARIETY_NAME_PLACEHOLDER = 'Variety name'
export const ADD_VARIETY = 'Add variety'
export const SAVE_PRICE = 'Save price'
export const EFFECTIVE_FROM = 'Effective from'
export const TODAY = 'Today'
export const LIST_PRICE = 'List price'
export const BULK_PRICE = 'Bulk price'
export const MINIMUM_QUANTITY = 'Minimum quantity'
export const VIP_PRICE = 'VIP price'

/** "In the catalog": the section and its form. */
export const IN_THE_CATALOG = 'In the catalog'
export const EDIT_CATALOG = 'Edit catalog'
export const SHOW_IN_CATALOG = 'Show in catalog'
export const SHOWN = 'Shown'
export const NOT_SHOWN = 'Not shown'
export const EMOJI = 'Emoji'
export const INDICA_SHARE = '% indica'
export const AROMA_FLAVOUR = 'Aroma/flavour'

/** A price row and its delete. */
export const CURRENT_TODAY = 'Current today'
export const effectiveFrom = (date: string) => `${EFFECTIVE_FROM} ${date}`
export const bulkFrom = (grams: string, price: string) => `From ${grams} · ${price}`
export const vipLine = (price: string) => `${VIP_PRICE} · ${price}`
export const DELETE_PRICE = 'Delete this price'
export const deletePriceTitle = (date: string) => `Delete the price effective from ${date}?`
/** What takes the deleted price's place (`priceDeleteNotice.ts`): amounts and dates already formatted. */
export const priceBack = (price: string, date: string) => `${price} x g applies again from ${date}`
export const noPriceBefore = (date: string) => `There will be no price before ${date}`

/** Leaving a form with something typed: the question, what is lost and the two answers. */
export const DISCARD_PRICE_QUESTION = 'Discard the price?'
export const DISCARD_VARIETY_QUESTION = 'Discard the variety?'
export const DISCARD_CHANGE_QUESTION = 'Discard the change?'
export const DISCARD_ENTERED_DETAIL = 'What you entered is lost: nothing has been saved yet.'
export const DISCARD_TYPED_DETAIL = 'What you typed is lost: nothing has been saved yet.'
export const KEEP_TYPING = 'No, keep typing'

/** Removing a variety: the two actions, their confirmations and the archive's detail line. */
export const DELETE_VARIETY = 'Delete variety'
export const ARCHIVE_VARIETY = 'Archive variety'
export const DELETE_VARIETY_QUESTION = 'Delete this variety?'
export const ARCHIVE_VARIETY_QUESTION = 'Archive this variety?'
export const DELETE_VARIETY_DETAIL = "No sales or entries. Deleted for good, with its prices. This can't be undone."
export const YES_ARCHIVE_IT = 'Yes, archive it'
const ARCHIVE_TAIL = 'it leaves Home and the lists, but its stock is kept.'
export const ARCHIVE_DETAIL_NO_STOCK = `If you archive it, ${ARCHIVE_TAIL}`
export const archiveDetailShortfall = (grams: string) => `It has a shortfall of ${grams}. If you archive it, ${ARCHIVE_TAIL}`
export const archiveDetailLeft = (grams: string) => `You have ${grams} left. If you archive it, ${ARCHIVE_TAIL}`

export const LIMITED_COPY: readonly LimitedCopy[] = [
  { kind: 'emptyTitle', text: EMPTY_TITLE },
  { kind: 'emptyLine', text: EMPTY_DETAIL },
  { kind: 'emptyTitle', text: NO_ARCHIVED_MESSAGE },
  { kind: 'help', text: PRICE_HISTORY_HELP },
  { kind: 'help', text: CATALOG_DISABLED_REASON },
  { kind: 'help', text: PRICE_PER_GRAM_HELP },
  { kind: 'help', text: PRICE_DISCOUNT_HELP },
  { kind: 'help', text: PRICE_FROM_GRAMS_HELP },
  { kind: 'help', text: VARIETY_NAME_HELP },
  { kind: 'help', text: DISCARD_ENTERED_DETAIL },
  { kind: 'help', text: DISCARD_TYPED_DETAIL },
]
export const LONG_REFUSALS: readonly string[] = []
