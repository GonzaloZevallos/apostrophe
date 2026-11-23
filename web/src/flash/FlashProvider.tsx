/**
 * Holds the flash toast (plan, "Flash toast") for everything under the gated layout:
 * feeds the router's `location.key` into `flashReducer`, renders the one toast while
 * `showing`, and runs the one auto-dismiss timer. Memory only.
 *
 * The timer restarts for a new toast (a new `id`), never for a followed redirect or any other
 * re-render. The current `location.key` is read through a ref written in a layout effect, so
 * `showNow` and `armAfterLeaving` keep one identity.
 */

import { useCallback, useEffect, useLayoutEffect, useMemo, useReducer, useRef, type ReactNode } from 'react'
import { useLocation } from 'react-router'
import AvisoExito, { SaleSavedToast } from '../components/AvisoExito'
import { FlashContext, type Flash } from './flashContext'
import UndoResultToast from './UndoResultToast'
import { FOLLOWED_REDIRECT, flashReducer, type FlashMessage, type FlashOptions } from './flashReducer'

function isFollowedRedirect(historyState: unknown): boolean {
  return (
    typeof historyState === 'object' &&
    historyState !== null &&
    'flashFollows' in historyState &&
    historyState.flashFollows === FOLLOWED_REDIRECT.flashFollows
  )
}

/** How long a toast stays when its caller does not say. */
export const DEFAULT_TOAST_MS = 2500
/** How long the sale-saved toast stays: long enough to reach its Undo. */
export const SALE_SAVED_TOAST_MS = 5000

export default function FlashProvider({ children }: { children: ReactNode }) {
  const { key, state: historyState } = useLocation()
  const follows = isFollowedRedirect(historyState)
  const [state, dispatch] = useReducer(flashReducer, { status: 'idle' })
  const currentKey = useRef(key)
  const nextId = useRef(0)

  useLayoutEffect(() => {
    currentKey.current = key
  }, [key])

  useEffect(() => {
    dispatch({ type: 'locationChanged', key, follows })
  }, [key, follows])

  const showing = state.status === 'showing'
  const id = state.status === 'idle' ? undefined : state.id
  const durationMs = state.status === 'idle' ? undefined : state.durationMs
  useEffect(() => {
    if (!showing) return
    const timer = setTimeout(() => dispatch({ type: 'expired' }), durationMs ?? DEFAULT_TOAST_MS)
    return () => clearTimeout(timer)
  }, [showing, id, durationMs])

  const armAfterLeaving = useCallback((message: FlashMessage, options?: FlashOptions) => {
    nextId.current += 1
    dispatch({ type: 'armAfterLeaving', message, id: nextId.current, currentKey: currentKey.current, ...options })
  }, [])
  const showNow = useCallback((message: FlashMessage, options?: FlashOptions) => {
    nextId.current += 1
    dispatch({ type: 'showNow', message, id: nextId.current, currentKey: currentKey.current, ...options })
  }, [])
  const flash = useMemo<Flash>(() => ({ armAfterLeaving, showNow }), [armAfterLeaving, showNow])

  const action = state.status === 'showing' ? state.action : undefined
  /** Pressing dismisses the toast first, then calls the caller's handler. */
  const onPress =
    action === undefined
      ? undefined
      : () => {
          dispatch({ type: 'dismissed' })
          action.onPress()
        }
  const message = state.status === 'showing' ? state.message : undefined

  return (
    <FlashContext.Provider value={flash}>
      {children}
      {message?.kind === 'text' && <AvisoExito texto={message.text} />}
      {message?.kind === 'saleSaved' && (
        <div className="aviso-flotante">
          <SaleSavedToast name={message.name} onUndo={onPress} />
        </div>
      )}
      {message?.kind === 'undoResult' && (
        <div className="aviso-flotante">
          <UndoResultToast result={message.result} />
        </div>
      )}
    </FlashContext.Provider>
  )
}
