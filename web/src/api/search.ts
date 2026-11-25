/**
 * The Global search (`GET /api/search`, docs/product/search.md), over `api/client.ts` only.
 * Matches `app/search` field for field. Nothing calls it yet: the computer header's box that
 * does is the issue's Part 2, so `scripts/docs/front-exclude.json` lists it until then.
 *
 * `search(q)` sends `q` as typed, encoded once: the server trims, folds and answers three empty
 * groups to a short query, so the client never short-circuits it.
 */

import { get } from './client'

export interface SaleHit {
  id: number
  /** The Sale number the seller reads off a Sale bill. */
  number: number
  date: string
  /** `null` for a Sale without a customer. */
  customer: { id: number; name: string } | null
  /** What the Customer pays: the lines plus the Shipping charged, as the Sales list shows it. */
  total: number
}

export interface CustomerHit {
  id: number
  name: string
  /** Signed, in currency units (ADR-0058): a Credit is below zero. */
  balance: number
}

// No `unit` field: docs/product/search.md "Sin unidad"; the Unit arrives with GH-318.
export interface ProductHit {
  id: number
  name: string
  /** Today's Stock, as the other stock answers carry it. */
  quantity: number
}

export interface SearchResult {
  sales: SaleHit[]
  customers: CustomerHit[]
  products: ProductHit[]
}

export function search(q: string): Promise<SearchResult> {
  return get<SearchResult>(`/api/search?q=${encodeURIComponent(q)}`)
}
