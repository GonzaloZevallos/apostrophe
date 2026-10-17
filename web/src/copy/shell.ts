/** The `shell` section of the app's texts: the bar, the sidebar and their labels. */

import type { LimitedCopy } from './limits'

/** The seven places the bar and the sidebar lead to, by the glossary's word. */
export const TAB_HOME = 'Home'
export const TAB_SALES = 'Sales'
export const TAB_CUSTOMERS = 'Customers'
export const TAB_VARIETIES = 'Varieties'
export const TAB_EXPENSES = 'Expenses'
export const TAB_ANALYSIS = 'Analysis'
export const TAB_MORE = 'More'

/** The accessible name of the bar and of the sidebar, and the button that opens a sale. */
export const NAVIGATION = 'Navigation'
export const NEW_SALE = 'New sale'

/** The sidebar's business entry: where the business's settings are. */
export const settingsOf = (business: string) => `Settings of ${business}`

export const LIMITED_COPY: readonly LimitedCopy[] = []
export const LONG_REFUSALS: readonly string[] = []
