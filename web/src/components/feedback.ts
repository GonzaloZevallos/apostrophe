/**
 * The closed set of strings `Notice` is ever asked to render (plan, "Gone
 * records" and "Feedback"): a success toast from `TOAST_MESSAGES` — the PRD's
 * own fixed strings for what this subtask saves — or the gone notice
 * (`GONE_NOTICE`, from `refusals.ts`). Kept out of `Notice.tsx` itself so that
 * file only exports the component (react-refresh's `only-export-components`).
 *
 * `readFeedback` is the only way a screen turns a navigation's `location.state`
 * into something `Notice` renders: it checks the value against
 * `TOAST_MESSAGES` and `GONE_NOTICE` itself, rather than trusting an unchecked
 * cast — an arbitrary string pushed into history state renders nothing.
 */

import { GONE_NOTICE } from '../api/refusals'

/** Every success toast this subtask's screens can show (PRD, "Feedback"). */
export const TOAST_MESSAGES = ['Cliente guardado'] as const

export type ToastMessage = (typeof TOAST_MESSAGES)[number]

function isToastMessage(value: unknown): value is ToastMessage {
  return typeof value === 'string' && (TOAST_MESSAGES as readonly string[]).includes(value)
}

export interface Feedback {
  kind: 'toast' | 'notice'
  message: string
}

export function readFeedback(state: unknown): Feedback | null {
  if (state === null || typeof state !== 'object') return null
  const record = state as Record<string, unknown>
  if (isToastMessage(record.toast)) return { kind: 'toast', message: record.toast }
  if (record.notice === GONE_NOTICE) return { kind: 'notice', message: GONE_NOTICE }
  return null
}
