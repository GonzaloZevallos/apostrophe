/**
 * The forms a variety's page opens over itself (`rename`, `threshold`, `catalog`). A form
 * has no path of its own: opening one pushes a history entry on the page's own path with
 * `{ form }` as its state, so Back closes it, and `readForm` reads that state back. A state
 * that names no known form reads as no form at all.
 */

import { useCallback } from 'react'
import { useNavigate } from 'react-router'
import { NAME_ARCHIVED_MESSAGE } from '../../copy/refusals'
import { type RefusalCode } from '../../api/refusals'
import { NAME_INVALID_MESSAGE, NAME_TAKEN_MESSAGE } from '../../copy/varieties'

export type VarietyForm = 'rename' | 'threshold' | 'catalog'

const FORMS: readonly VarietyForm[] = ['rename', 'threshold', 'catalog']

export function readForm(state: unknown): VarietyForm | null {
  if (typeof state !== 'object' || state === null || !('form' in state)) return null
  const { form } = state
  if (typeof form !== 'string' || !(FORMS as readonly string[]).includes(form)) return null
  return form as VarietyForm
}

/** Opens a form by pushing a history entry on the page's own path. */
export function useOpenForm(): (form: VarietyForm) => void {
  const navigate = useNavigate()
  return useCallback((form) => void navigate('.', { state: { form } }), [navigate])
}

/** The messages of the refusals of a variety's name on save (`POST /varieties`). */
export const SAVE_OVERRIDES: Partial<Record<RefusalCode, string>> = {
  'variety.name_taken': NAME_TAKEN_MESSAGE,
  'variety.name_archived': NAME_ARCHIVED_MESSAGE,
  'variety.name_invalid': NAME_INVALID_MESSAGE,
}
