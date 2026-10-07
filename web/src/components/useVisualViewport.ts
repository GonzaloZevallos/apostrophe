/**
 * `useVisualViewport(ref)`: pins Nueva venta's three-zone form to the part of the page the
 * user can actually see (ADR-0028), so the fixed footer rides above the on-screen keyboard.
 * It writes `--vv-top` and `--vv-alto` (the visual viewport's offset and height, in px) on
 * the element and sets `data-teclado="abierto"` while the keyboard is up.
 *
 * It reads only viewport geometry, and does nothing on a computer layout or where
 * `window.visualViewport` is missing. While the page is pinch-zoomed (`scale !== 1`) the
 * visual viewport's numbers describe the zoom, not a keyboard: the pin and the flag are
 * removed and events are ignored until the scale is back at 1.
 */

import { type RefObject, useEffect } from 'react'
import { useViewport } from '../shell/useViewport'

const FIXED_FORM_CLASS = 'html--formulario-fijo'
const KEYBOARD_GAP_PX = 120

export function useVisualViewport(ref: RefObject<HTMLElement | null>): void {
  const layout = useViewport()
  useEffect(() => {
    const element = ref.current
    const viewport = window.visualViewport
    if (!element || !viewport) return
    if (layout === 'computer') return

    const clear = () => {
      element.style.removeProperty('--vv-top')
      element.style.removeProperty('--vv-alto')
      element.removeAttribute('data-teclado')
    }

    const sync = () => {
      if (viewport.scale !== 1) {
        clear()
        return
      }
      element.style.setProperty('--vv-top', `${viewport.offsetTop}px`)
      element.style.setProperty('--vv-alto', `${viewport.height}px`)
      if (window.innerHeight - viewport.height > KEYBOARD_GAP_PX) {
        element.setAttribute('data-teclado', 'abierto')
      } else {
        element.removeAttribute('data-teclado')
      }
    }

    document.documentElement.classList.add(FIXED_FORM_CLASS)
    viewport.addEventListener('resize', sync)
    viewport.addEventListener('scroll', sync)
    sync()

    return () => {
      viewport.removeEventListener('resize', sync)
      viewport.removeEventListener('scroll', sync)
      document.documentElement.classList.remove(FIXED_FORM_CLASS)
      clear()
    }
  }, [ref, layout])
}
