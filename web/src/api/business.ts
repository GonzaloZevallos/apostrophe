/**
 * `GET /business`: the business's users and the languages it can show. The Users group and the
 * phone Settings home's card read it through this one query (same key, same function), so they
 * cannot show different counts; the home also feeds `selectableLanguages` from it.
 */

import { queryOptions } from '@tanstack/react-query'
import { get } from './client'
import { keys } from './keys'
import type { LanguageTag } from './language'

export interface Business {
  users: { email: string }[]
  selectable_languages: readonly LanguageTag[]
}

export function businessQueryOptions() {
  return queryOptions({
    queryKey: keys.business(),
    queryFn: () => get<Business>('/business'),
  })
}
