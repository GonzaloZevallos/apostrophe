/**
 * Labels a spec needs in full. `getByLabel` matches the text of the whole `<label>`, so a hint
 * written inside the label is part of it: the exact match (`{ exact: true }`, GH-734) takes the
 * label's text as the page holds it, from the copy module, never a regex.
 */

import { COMMON_TEXT } from '../../src/copy/common.js'
import { COST_REQUIRED_HELP, STOCK_TEXT } from '../../src/copy/stock.js'
import { VARIETY_NAME_HELP } from '../../src/copy/varieties.js'

/** The product name field on New product: its label's two spans (name, hint) have no text between them. */
export const VARIETY_NAME_LABEL = `${COMMON_TEXT.name}${VARIETY_NAME_HELP}`

/** The cost field of the stock entry form that is not locked (a purchase needs it). */
export const STOCK_COST_LABEL = `${STOCK_TEXT.costoTotal}${COST_REQUIRED_HELP}`
