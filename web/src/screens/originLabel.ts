/** The key of the word for a stock entry's origin, shared by every list of entries. Each list
 * resolves it with its own `t` on every render, so the word follows a language switch. */

import type { StockEntry } from '../api/stock'
import type { CopyKey } from '../i18n/resources.generated'

export const ORIGIN_LABEL: Record<StockEntry['origin'], CopyKey> = {
  purchase: 'common:purchase',
  harvest: 'common:harvest',
  opening_stock: 'common:initialStock',
  adjustment: 'common:adjustment',
}
