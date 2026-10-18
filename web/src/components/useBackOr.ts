/**
 * "Back, or else the fixed parent" (plan, "Back"). Every in-app link into Configuración
 * carries the state `inAppState` writes; only an entry that carries it is known to have the app
 * behind it, so only then does back go through history. Anything else (a typed address, a
 * bookmark, a reload that dropped the state) goes to `fallback` with `replace`, so the
 * entry that is left does not stay behind to be walked back into.
 *
 * `fallback` is a path, or a function that answers one: the function is called when back is
 * tapped, not when the screen renders, so a parent that depends on a record that arrived
 * after the first render (an archived variety's "Archivadas") is the one the seller sees.
 */

import { useCallback, useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router'

function isInApp(state: unknown): boolean {
  return typeof state === 'object' && state !== null && 'inApp' in state && state.inApp === true
}

export function useBackOr(fallback: string | (() => string)): () => void {
  const navigate = useNavigate()
  const location = useLocation()
  const inApp = isInApp(location.state)
  const latest = useRef(fallback)
  useEffect(() => {
    latest.current = fallback
  }, [fallback])
  return useCallback(() => {
    if (inApp) {
      void navigate(-1)
    } else {
      const target = latest.current
      void navigate(typeof target === 'function' ? target() : target, { replace: true })
    }
  }, [navigate, inApp])
}
