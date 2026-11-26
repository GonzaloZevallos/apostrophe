/**
 * `ConfirmLayer`: the one layer every confirmation is drawn in on the phone, above the bottom
 * bar, its + and the sheets (ADR 20261126). It wraps the app in a `display: contents` div and
 * renders, next to it, the host `div.confirm-layer`, which is never inert.
 *
 * It is the only owner of the app's `inert`/`aria-hidden` and of `html--confirmando`. A
 * `ConfirmDialog` calls `register(id, root)` when it mounts on the phone and `release(id)` when it
 * goes; both write the DOM synchronously, never through a render, so nothing is left behind by an
 * unmount that skips an effect:
 * - while the stack is not empty on the phone: `inert` and `aria-hidden` on the wrapper,
 *   `html--confirmando` on `<html>` (and no other class) and `data-open` on the host;
 * - every registered dialog but the top one is `inert` and `aria-hidden` too.
 * The stack lives in a ref; a counter in state only re-renders the readers of `isTop`.
 */

import {
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useViewport } from '../shell/useViewport'
import { ConfirmLayerContext, StackVersionContext, type ConfirmLayerApi } from './confirmLayerContext'
import { useVisualViewport } from './useVisualViewport'

const LOCK_CLASS = 'html--confirmando'

interface Entry {
  id: string
  root: HTMLElement
}

function setHidden(element: Element, hidden: boolean): void {
  element.toggleAttribute('inert', hidden)
  if (hidden) element.setAttribute('aria-hidden', 'true')
  else element.removeAttribute('aria-hidden')
}

export default function ConfirmLayer({ children }: { children: ReactNode }) {
  const phone = useViewport() === 'phone'
  const wrapper = useRef<HTMLDivElement>(null)
  const hostRef = useRef<HTMLDivElement>(null)
  const [host, setHost] = useState<HTMLElement | null>(null)
  const [version, setVersion] = useState(0)
  const stack = useRef<Entry[]>([])
  const phoneNow = useRef(phone)

  useVisualViewport(hostRef, { fixedForm: false })

  const apply = useCallback(() => {
    const open = stack.current.length > 0 && phoneNow.current
    if (wrapper.current) setHidden(wrapper.current, open)
    hostRef.current?.toggleAttribute('data-open', open)
    document.documentElement.classList.toggle(LOCK_CLASS, open)
    const top = stack.current.length - 1
    stack.current.forEach((entry, index) => setHidden(entry.root, open && index !== top))
  }, [])

  const register = useCallback(
    (id: string, root: HTMLElement) => {
      stack.current = [...stack.current.filter((entry) => entry.id !== id), { id, root }]
      apply()
      setVersion((version) => version + 1)
    },
    [apply],
  )

  const release = useCallback(
    (id: string) => {
      const gone = stack.current.find((entry) => entry.id === id)
      if (!gone) return
      stack.current = stack.current.filter((entry) => entry.id !== id)
      setHidden(gone.root, false)
      apply()
      setVersion((version) => version + 1)
    },
    [apply],
  )

  const isTop = useCallback((id: string) => stack.current.at(-1)?.id === id, [])

  // Crossing 900 px applies the stack again: cleared on the computer, restored on the phone.
  useLayoutEffect(() => {
    phoneNow.current = phone
    apply()
  }, [phone, apply])

  // The scrim is not a control: cancelling its pointerdown keeps focus where it was.
  useEffect(() => {
    const element = hostRef.current
    if (!element) return
    const cancel = (event: PointerEvent) => {
      if (event.target === element) event.preventDefault()
    }
    element.addEventListener('pointerdown', cancel)
    return () => element.removeEventListener('pointerdown', cancel)
  }, [])

  useLayoutEffect(() => setHost(hostRef.current), [])

  const api = useMemo<ConfirmLayerApi>(
    () => ({ register, release, isTop, host }),
    [register, release, isTop, host],
  )

  return (
    <ConfirmLayerContext.Provider value={api}>
      <StackVersionContext.Provider value={version}>
        <div ref={wrapper} className="confirm-app">
          {children}
        </div>
        <div ref={hostRef} className="confirm-layer" />
      </StackVersionContext.Provider>
    </ConfirmLayerContext.Provider>
  )
}
