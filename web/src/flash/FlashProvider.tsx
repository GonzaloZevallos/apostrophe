/**
 * Holds the flash toast (plan, "Flash toast") for everything under the gated layout:
 * feeds the router's `location.key` into `flashReducer`, renders the one
 * `AvisoExito` while `showing`, and runs the one auto-dismiss timer. Memory only.
 */

import { useCallback, useEffect, useMemo, useReducer, type ReactNode } from 'react'
import { useLocation } from 'react-router'
import AvisoExito, { type SuccessToast } from '../components/AvisoExito'
import { FlashContext, type Flash } from './flashContext'
import { FOLLOWED_REDIRECT, flashReducer } from './flashReducer'

function isFollowedRedirect(historyState: unknown): boolean {
  return (
    typeof historyState === 'object' &&
    historyState !== null &&
    'flashFollows' in historyState &&
    historyState.flashFollows === FOLLOWED_REDIRECT.flashFollows
  )
}

/** The same duration the other screens' toasts use. */
const TOAST_MS = 2500

export default function FlashProvider({ children }: { children: ReactNode }) {
  const { key, state: historyState } = useLocation()
  const follows = isFollowedRedirect(historyState)
  const [state, dispatch] = useReducer(flashReducer, { status: 'idle' })

  useEffect(() => {
    dispatch({ type: 'locationChanged', key, follows })
  }, [key, follows])

  useEffect(() => {
    if (state.status !== 'showing') return
    const timer = setTimeout(() => dispatch({ type: 'expired' }), TOAST_MS)
    return () => clearTimeout(timer)
  }, [state])

  const armAfterLeaving = useCallback(
    (toast: SuccessToast) => dispatch({ type: 'armAfterLeaving', toast, currentKey: key }),
    [key],
  )
  const showNow = useCallback(
    (toast: SuccessToast) => dispatch({ type: 'showNow', toast, currentKey: key }),
    [key],
  )
  const flash = useMemo<Flash>(() => ({ armAfterLeaving, showNow }), [armAfterLeaving, showNow])

  return (
    <FlashContext.Provider value={flash}>
      {children}
      {state.status === 'showing' && <AvisoExito texto={state.toast} />}
    </FlashContext.Provider>
  )
}
