/**
 * `PUT /api/money-format`: the Business's symbol and decimals (ADR-0080). The body and the
 * answer carry the two values and never the scale amounts are stored at (ADR-0058); the
 * business comes from the session.
 */

import type { MoneyFormat } from '../format/money'
import { put } from './client'

export function saveMoneyFormat(format: MoneyFormat): Promise<MoneyFormat> {
  return put<MoneyFormat>('/api/money-format', { symbol: format.symbol, decimals: format.decimals })
}
