/**
 * `GET /auth/me`: the front's one clock ("today") and the signed-in business's name
 * (plan, "One clock"; invariant: "today" comes only from here, API dates are never
 * turned into a `Date`). Every screen that needs either reads it through `keys.me()`.
 */

import { get } from './client'
import type { ShownLanguage } from './language'

/** How the business shows money: its symbol and decimals. The stored scale never reaches the front. */
export interface MoneyFormat {
  symbol: string
  decimals: number
}

export interface Me {
  email: string
  business_name: string
  today: string
  /** The forced language when the operator set one, else the stored one: what decides the texts. */
  shown_language: ShownLanguage
  money: MoneyFormat
}

export function getMe(): Promise<Me> {
  return get<Me>('/auth/me')
}
