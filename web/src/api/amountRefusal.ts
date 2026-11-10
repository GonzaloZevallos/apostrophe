/**
 * The refusal an amount field shows when the backend answers `money.too_many_decimals`
 * (ADR-0058): fixed text from `copy/settings.ts`, chosen by the business's decimals, and
 * never the response's `detail`. Every form with an amount keeps what was typed and shows
 * this under the field, so it is spelt once here.
 */

import { moneyTooManyDecimals } from '../copy/settings'
import { MONEY_DECIMALS } from '../format/money'
import type { RefusalCode } from './refusals'

export const TOO_MANY_DECIMALS_CODE: RefusalCode = 'money.too_many_decimals'

export const TOO_MANY_DECIMALS_MESSAGE: string = moneyTooManyDecimals(MONEY_DECIMALS)
