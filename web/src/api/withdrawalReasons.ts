/**
 * Calls for the business's own list of withdrawal reasons (`GET/POST /api/withdrawal-reasons`,
 * `PATCH/DELETE /api/withdrawal-reasons/{id}`, `POST /api/withdrawal-reasons/{id}/move`).
 * Every call goes through `api/client.ts`. The list is always in the order the server keeps:
 * the front never sorts it.
 */

import { del, patch, post } from './client'
import type { WithdrawalReasonItem } from './stock'

export type { WithdrawalReasonItem }

export type MoveDirection = 'up' | 'down'

export function addReason(name: string): Promise<WithdrawalReasonItem> {
  return post<WithdrawalReasonItem>('/api/withdrawal-reasons', { name })
}

export function renameReason(id: number, name: string): Promise<WithdrawalReasonItem> {
  return patch<WithdrawalReasonItem>(`/api/withdrawal-reasons/${id}`, { name })
}

export function removeReason(id: number): Promise<void> {
  return del<void>(`/api/withdrawal-reasons/${id}`)
}

/** Answers the whole ordered list after the move. */
export function moveReason(id: number, direction: MoveDirection): Promise<WithdrawalReasonItem[]> {
  return post<WithdrawalReasonItem[]>(`/api/withdrawal-reasons/${id}/move`, { direction })
}
