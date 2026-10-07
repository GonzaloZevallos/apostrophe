/**
 * Holds the flash toast (plan, "Flash toast") for everything under the gated layout:
 * feeds the router's `location.key` into `flashReducer`, renders the one
 * `AvisoExito` while `showing`, and runs the one auto-dismiss timer. Memory only.
 */

import { useCallback, useEffect, useMemo, useReducer, type ReactNode } from 'react'
import { useLocation } from 'react-router'
import AvisoExito, { type SuccessToast } from '../components/AvisoExito'
import { FlashContext, type Flash } from './flashContext'
import { flashReducer } from './flashReducer'

/** The same duration the other screens' toasts use. */
const TOAST_MS = 2500

export default function FlashProvider({ children }: { children: ReactNode }) {
  const { key } = useLocation()
  const [state, dispatch] = useReducer(flashReducer, { status: 'idle' })

  useEffect(() => {
    dispatch({ type: 'locationChanged', key })
  }, [key])

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
  const keepAcrossReplace = useCallback(() => dispatch({ type: 'keepAcrossReplace' }), [])
  const flash = useMemo<Flash>(
    () => ({ armAfterLeaving, showNow, keepAcrossReplace }),
    [armAfterLeaving, showNow, keepAcrossReplace],
  )

  return (
    <FlashContext.Provider value={flash}>
      {children}
      {state.status === 'showing' && <AvisoExito texto={state.toast} />}
    </FlashContext.Provider>
  )
}
