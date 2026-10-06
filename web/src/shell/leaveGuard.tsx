/**
 * The one leave guard for every form and sheet ("Unsaved-changes guard", `navigation.md`):
 * a screen that was touched asks before it is discarded, one that was not closes at
 * once. "Cerrar" (`requestClose`) and the router's own Back (`useBlocker`) open the same
 * dialog, so there is exactly one blocker per screen, and the screen never asks after a
 * successful save (`allowLeave`, called just before navigating or closing).
 *
 * "Touched" means the current values differ from the seed captured once when the form
 * opened (`useTouched`) — a default (today's date, a preselected origin, a customer
 * passed in) is not a change. The wording is a per-form choice: `SHARED_WORDING` by
 * default, Nueva venta passes its own.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useBlocker, useLocation, useNavigate } from 'react-router'
import ConfirmDialog from '../components/ConfirmDialog'

export interface Wording {
  title: string
  detail: string
  stayText: string
  discardText: string
}

export const SHARED_WORDING: Wording = {
  title: '¿Descartás los cambios?',
  detail: 'No vas a poder recuperar lo que cargaste.',
  stayText: 'No, seguí',
  discardText: 'Sí, descartalos',
}

export interface LeaveGuardState {
  /** The dialog is showing, asked by "Cerrar" or by the router's Back. */
  asking: boolean
  wording: Wording
  /** "Cerrar": leaves through `onLeave` at once when untouched, asks first otherwise. */
  requestClose: (onLeave: () => void) => void
  /** Call just before navigating or closing after a successful save: nothing asks. */
  allowLeave: () => void
  stay: () => void
  discard: () => void
}

export function useLeaveGuard({
  touched,
  wording = SHARED_WORDING,
}: {
  touched: boolean
  wording?: Wording
}): LeaveGuardState {
  const touchedRef = useRef(touched)
  useEffect(() => {
    touchedRef.current = touched
  }, [touched])
  const allowedRef = useRef(false)
  const shouldBlock = useCallback(() => touchedRef.current && !allowedRef.current, [])
  const blocker = useBlocker(shouldBlock)
  const [pendingLeave, setPendingLeave] = useState<(() => void) | null>(null)

  const requestClose = useCallback((onLeave: () => void): void => {
    if (!touchedRef.current || allowedRef.current) {
      onLeave()
      return
    }
    setPendingLeave(() => onLeave)
  }, [])

  const allowLeave = useCallback((): void => {
    allowedRef.current = true
  }, [])

  const stay = useCallback((): void => {
    setPendingLeave(null)
    if (blocker.state === 'blocked') blocker.reset()
  }, [blocker])

  const discard = useCallback((): void => {
    if (blocker.state === 'blocked') {
      blocker.proceed()
      return
    }
    allowedRef.current = true
    pendingLeave?.()
    setPendingLeave(null)
  }, [blocker, pendingLeave])

  return {
    asking: blocker.state === 'blocked' || pendingLeave !== null,
    wording,
    requestClose,
    allowLeave,
    stay,
    discard,
  }
}

export function LeaveGuard({ guard }: { guard: LeaveGuardState }) {
  if (!guard.asking) return null
  return (
    <ConfirmDialog
      title={guard.wording.title}
      detail={guard.wording.detail}
      confirmText={guard.wording.discardText}
      cancelText={guard.wording.stayText}
      onConfirm={guard.discard}
      onCancel={guard.stay}
    />
  )
}

/** The values a form opened with, captured once. `touched` is whether `values` differ
 * from them now; a value that is an object compares by its JSON, so a form passes its
 * fields as one plain object. */
export function useTouched(values: unknown): boolean {
  const [seed] = useState(() => JSON.stringify(values))
  return JSON.stringify(values) !== seed
}

/** Where "Cerrar" goes: back through history when there is any, else the screen's
 * parent (the same rule as the back arrow). */
export function useCloseTo(fallback: string): () => void {
  const navigate = useNavigate()
  const location = useLocation()
  return useCallback((): void => {
    if (location.key === 'default') navigate(fallback)
    else navigate(-1)
  }, [fallback, location.key, navigate])
}
