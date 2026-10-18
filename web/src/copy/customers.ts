/**
 * The fixed always-visible words of the Clientes screens (no JSX): their empty states, the
 * same bindings the screens render. Registered in `LIMITED_COPY` so
 * `copy/copyLimits.test.ts` measures them against the limit of the icon and text rule
 * (docs/product/icon-and-text-rule.md).
 */

import { NOBODY_OWES } from './common'
import { salesCount } from './format'
import type { LimitedCopy } from './limits'

/** Clientes' empty list. */
export const EMPTY_CUSTOMERS = "You haven't added any customers yet."
/** Heads everyone A–Z, under the Owed section (`Clientes.dc.html`). */
export const EVERYONE = 'Everyone · A–Z'

/** The Customers list: its search, its count line and its one action. */
export const SEARCH_LABEL = 'Search customer'
export const SEARCH_PLACEHOLDER = 'Phone or name'
export const SEARCHING = 'Searching…'
export const customerCount = (count: number) => `${count} ${count === 1 ? 'customer' : 'customers'}`
export const NEW_CUSTOMER = 'New customer'

/** The Owed section: its heading and the count of sales still owing. */
export const OWED = 'Owed'
export const salesOwing = (count: number) => `${salesCount(count)} owing`

/** A customer's row: what it says about money and its Collect button. */
export const owesSince = (date: string) => `owes you since ${date}`
export const creditOf = (amount: string) => `Credit ${amount}`
export const COLLECT = 'Collect'
export const collectFrom = (name: string) => `Collect from ${name}`

/** The customer fields shared by the form and the sale's sheet. */
export const PHONE = 'Phone'
export const NAME = 'Name'

/** The Record payment screen: its title and its leave confirmation. */
export const RECORD_PAYMENT = 'Record payment'
export const DISCARD_PAYMENT_QUESTION = 'Discard the payment?'
export const LEAVE_DETAIL = "What you entered is lost: nothing has been saved yet."
export const KEEP_EDITING = 'No, keep going'
export const DISCARD = 'Yes, discard it'

/** Still the Spanish the app had: the Spanish rule (`architecture/copySpanish.ts`) skips a
 * section that says so. Removed with the section's English wording (ADR-0048). */
export const PENDING = true

export const LIMITED_COPY: readonly LimitedCopy[] = [
  { kind: 'emptyTitle', text: EMPTY_CUSTOMERS },
  { kind: 'emptyTitle', text: NOBODY_OWES },
]
export const LONG_REFUSALS: readonly string[] = []
