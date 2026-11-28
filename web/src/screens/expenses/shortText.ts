/**
 * The words of a short amount: `shortAmount`'s data written with the Business's symbol and the
 * suffix from the copy. It is the only reader of `thousandSuffix` and `millionSuffix`. It takes the
 * symbol from `money.format` and never reads back the text `money()` writes; the million's tenths are
 * split in integers.
 */

import { EXPENSES_TEXT } from '../../copy/expenses'
import { groupThousands, type MoneyFormatter } from '../../format/money'
import type { ShortAmount } from './expensesSummary'

/** `{ none, 950 }` reads `$ 950`, `{ thousand, 90 }` reads `$90k` and `{ million, 12346 }` reads
 * `$1.234,6M`. Negatives and zero only ever arrive as `none`, because `shortAmount` sends everything
 * under 1,000 there; `thousand` and `million` carry positive whole numbers. */
export function shortText(short: ShortAmount, money: MoneyFormatter): string {
  const { symbol } = money.format
  switch (short.unit) {
    case 'none':
      return money.money(short.value)
    case 'thousand':
      return `${symbol}${groupThousands(String(short.value))}${EXPENSES_TEXT.thousandSuffix}`
    case 'million':
      return `${symbol}${groupThousands(String(Math.floor(short.value / 10)))},${short.value % 10}${EXPENSES_TEXT.millionSuffix}`
  }
}
