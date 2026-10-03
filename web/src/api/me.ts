/**
 * `GET /auth/me`: the front's one clock ("today") and the signed-in business's name
 * (plan, "One clock"; invariant: "today" comes only from here, API dates are never
 * turned into a `Date`). Every screen that needs either reads it through `keys.me()`.
 */

import { get } from './client'

export interface Me {
  email: string
  business_name: string
  today: string
}

export function getMe(): Promise<Me> {
  return get<Me>('/auth/me')
}
