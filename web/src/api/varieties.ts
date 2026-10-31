/**
 * The variety lifecycle calls (`varieties.md`, "Deleting and archiving"): `GET /api/products/{id}`
 * also says which one removal the page offers (`removal`, worked out from history when it
 * is read), and the three writes. Archive and restore are never refused for history; only a
 * delete is (`variety.has_history`).
 */

import { del, post } from './client'

export type Removal = 'delete' | 'archive'

/** The unit a product is measured in; `decimals` is how many a quantity of it may have. */
export interface ProductUnit {
  id: number
  name: string
  label: string
  decimals: number
}

export interface VarietyDetail {
  id: number
  name: string
  archived: boolean
  unit: ProductUnit
  removal: Removal | null
}

export function archiveVariety(varietyId: number): Promise<VarietyDetail> {
  return post<VarietyDetail>(`/api/products/${varietyId}/archive`)
}

export function restoreVariety(varietyId: number): Promise<VarietyDetail> {
  return post<VarietyDetail>(`/api/products/${varietyId}/restore`)
}

export function deleteVariety(varietyId: number): Promise<void> {
  return del<void>(`/api/products/${varietyId}`)
}
