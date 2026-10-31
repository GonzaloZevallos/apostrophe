/**
 * Types and calls for the business's own units (`GET/POST /api/units`, `PATCH/DELETE
 * /api/units/{id}`). Every call goes through `api/client.ts`. `product_count` is how many
 * products use the unit (the Units list and its delete refusal read it).
 */

import { del, get, patch, post } from './client'
import type { ProductUnit } from './varieties'

export interface Unit extends ProductUnit {
  product_count: number
}

export interface UnitInput {
  name: string
  label: string
  decimals: number
}

export function listUnits(): Promise<Unit[]> {
  return get<Unit[]>('/api/units')
}

export function addUnit(body: UnitInput): Promise<Unit> {
  return post<Unit>('/api/units', body)
}

export function editUnit(id: number, body: Partial<UnitInput>): Promise<Unit> {
  return patch<Unit>(`/api/units/${id}`, body)
}

export function removeUnit(id: number): Promise<void> {
  return del<void>(`/api/units/${id}`)
}

/** Gives a product another unit (`PATCH /api/products/{id}` with only `unit_id`). */
export function changeProductUnit(productId: number, unitId: number): Promise<void> {
  return patch<void>(`/api/products/${productId}`, { unit_id: unitId })
}
