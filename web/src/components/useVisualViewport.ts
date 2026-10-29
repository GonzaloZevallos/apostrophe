/**
 * `useVisualViewport(ref, { fixedForm })`: pins a phone form to the part of the page the user
 * can actually see (ADR-0028), so its fixed footer rides above the on-screen keyboard. It
 * writes `--vv-top` and `--vv-alto` (the visual viewport's offset and height, in px) on the
 * element and sets `data-teclado="abierto"` while the keyboard is up.
 *
 * Whether the keyboard is up is decided only by `keyboard.ts` (`isKeyboardOpen`); this hook
 * follows its store and writes the result. It does nothing on a computer layout. While the
 * page is pinch-zoomed the pin and the flag are removed until the scale is back at 1.
 * Where `window.visualViewport` is missing nothing is pinned, and the flag follows focus on a
 * text-entry control.
 *
 * `fixedForm` (default true: Nueva venta's call) sets `html--formulario-fijo` on `<html>` while
 * mounted, so the page itself does not scroll behind a form that owns the screen. The shell and
 * the sheets pass false: they pin or hide things, they do not own the page.
 *
 * It follows the store through a synchronous subscription, not `useSyncExternalStore`: the
 * element is written on the event itself, as the existing hook tests expect.
 */

import { type RefObject, useEffect } from 'react'
import { useViewport } from '../shell/useViewport'
import { type KeyboardState, subscribeKeyboard } from './keyboard'

const FIXED_FORM_CLASS = 'html--formulario-fijo'

export interface VisualViewportOptions {
  fixedForm?: boolean
}

export function useVisualViewport(
  ref: RefObject<HTMLElement | null>,
  { fixedForm = true }: VisualViewportOptions = {},
): void {
  const layout = useViewport()
  useEffect(() => {
    const element = ref.current
    if (!element) return
    if (layout === 'computer') return

    const clear = () => {
      element.style.removeProperty('--vv-top')
      element.style.removeProperty('--vv-alto')
      element.removeAttribute('data-teclado')
    }

    const write = ({ open, viewport }: KeyboardState) => {
      if (viewport) {
        element.style.setProperty('--vv-top', `${viewport.top}px`)
        element.style.setProperty('--vv-alto', `${viewport.height}px`)
      } else {
        element.style.removeProperty('--vv-top')
        element.style.removeProperty('--vv-alto')
      }
      if (open) element.setAttribute('data-teclado', 'abierto')
      else element.removeAttribute('data-teclado')
    }

    const pinsPage = fixedForm && window.visualViewport != null
    if (pinsPage) document.documentElement.classList.add(FIXED_FORM_CLASS)
    const unsubscribe = subscribeKeyboard(write)

    return () => {
      unsubscribe()
      if (pinsPage) document.documentElement.classList.remove(FIXED_FORM_CLASS)
      clear()
    }
  }, [ref, layout, fixedForm])
}
