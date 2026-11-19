/**
 * New sale's suggestions (`GET /api/sales/suggestions`, docs/product/sales.md): ids only, they
 * shorten choices and never set a price, an amount or a quantity. Fetched once per New sale
 * opening and keyed on the opening date (`keys.saleFormSuggestions`), never on the edited sale date.
 * Every failure but a lost session resolves to no suggestions, silently.
 */

import { useQuery } from '@tanstack/react-query'
import { ApiError, get } from './client'
import { keys } from './keys'

/** Twin of the server's `SuggestionsOut`. */
export interface SaleSuggestions {
  recent_customer_ids: number[]
  most_sold_product_ids: number[]
  last_payment_method_id: number | null
}

/** The properties of `SuggestionsOut`, checked against the OpenAPI snapshot by a test. */
export const SUGGESTIONS_KEYS = [
  'recent_customer_ids',
  'most_sold_product_ids',
  'last_payment_method_id',
] as const

export const EMPTY_SUGGESTIONS: SaleSuggestions = {
  recent_customer_ids: [],
  most_sold_product_ids: [],
  last_payment_method_id: null,
}

function isIdList(value: unknown): value is number[] {
  return Array.isArray(value) && value.every((item) => Number.isInteger(item))
}

function isSuggestions(body: unknown): body is SaleSuggestions {
  if (typeof body !== 'object' || body === null) return false
  const candidate = body as Record<string, unknown>
  const last = candidate.last_payment_method_id
  return (
    isIdList(candidate.recent_customer_ids) &&
    isIdList(candidate.most_sold_product_ids) &&
    (last === null || Number.isInteger(last))
  )
}

export async function fetchSaleSuggestions(on: string): Promise<SaleSuggestions> {
  const body: unknown = await get<unknown>(`/api/sales/suggestions?${new URLSearchParams({ on })}`)
  return isSuggestions(body) ? body : EMPTY_SUGGESTIONS
}

/** A lost session (401) is rethrown so `QueryCache.onError` sends the seller to sign in; every other
 * failure (another status, a dropped network, a malformed body) is no suggestions. */
async function suggestionsOrEmpty(on: string): Promise<SaleSuggestions> {
  try {
    return await fetchSaleSuggestions(on)
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) throw error
    return EMPTY_SUGGESTIONS
  }
}

/** One GET per New sale opening: pass the draft's `openedOn`, never its editable date. */
export function useSaleSuggestions(openedOn: string): SaleSuggestions {
  const query = useQuery({
    queryKey: keys.saleFormSuggestions(openedOn),
    queryFn: () => suggestionsOrEmpty(openedOn),
    gcTime: 0,
    staleTime: Infinity,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: true,
  })
  return query.data ?? EMPTY_SUGGESTIONS
}
