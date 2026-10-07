/**
 * "Back, or else the fixed parent" (plan, "Back"). Every in-app link into Configuración
 * carries the state `inAppState` writes; only an entry that carries it is known to have the app
 * behind it, so only then does back go through history. Anything else (a typed address, a
 * bookmark, a reload that dropped the state) goes to `fallback` with `replace`, so the
 * entry that is left does not stay behind to be walked back into.
 */

import { useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router'

function isInApp(state: unknown): boolean {
  return typeof state === 'object' && state !== null && 'inApp' in state && state.inApp === true
}

export function useBackOr(fallback: string): () => void {
  const navigate = useNavigate()
  const location = useLocation()
  const inApp = isInApp(location.state)
  return useCallback(() => {
    if (inApp) {
      void navigate(-1)
    } else {
      void navigate(fallback, { replace: true })
    }
  }, [navigate, inApp, fallback])
}
