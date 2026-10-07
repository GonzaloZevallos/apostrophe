/**
 * The variety lifecycle calls (`varieties.md`, "Deleting and archiving"): `GET /varieties/{id}`
 * also says which one removal the page offers (`removal`, worked out from history when it
 * is read), and the three writes. Archive and restore are never refused for history; only a
 * delete is (`variety.has_history`).
 */

import { del, post } from './client'

export type Removal = 'delete' | 'archive'

export interface VarietyDetail {
  id: number
  name: string
  archived: boolean
  removal: Removal | null
}

export function archiveVariety(varietyId: number): Promise<VarietyDetail> {
  return post<VarietyDetail>(`/varieties/${varietyId}/archive`)
}

export function restoreVariety(varietyId: number): Promise<VarietyDetail> {
  return post<VarietyDetail>(`/varieties/${varietyId}/restore`)
}

export function deleteVariety(varietyId: number): Promise<void> {
  return del<void>(`/varieties/${varietyId}`)
}
