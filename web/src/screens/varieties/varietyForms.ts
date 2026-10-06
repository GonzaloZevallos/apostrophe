/**
 * The forms a variety's page opens over itself (`rename`, `threshold`, `catalog`). A form
 * has no path of its own: opening one pushes a history entry on the page's own path with
 * `{ form }` as its state, so Back closes it, and `readForm` reads that state back. A state
 * that names no known form reads as no form at all.
 */

import { useCallback } from 'react'
import { useNavigate } from 'react-router'

export type VarietyForm = 'rename' | 'threshold' | 'catalog'

const FORMS: readonly string[] = ['rename', 'threshold', 'catalog'] satisfies VarietyForm[]

export function readForm(state: unknown): VarietyForm | null {
  if (typeof state !== 'object' || state === null || !('form' in state)) return null
  const { form } = state
  if (typeof form !== 'string' || !FORMS.includes(form)) return null
  return form as VarietyForm
}

/** Opens a form by pushing a history entry on the page's own path. */
export function useOpenForm(): (form: VarietyForm) => void {
  const navigate = useNavigate()
  return useCallback((form) => void navigate('.', { state: { form } }), [navigate])
}
