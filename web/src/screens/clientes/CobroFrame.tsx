/**
 * `CobroFrame`: what surrounds Registrar cobro's form. Presentational only: its host
 * (`CobroRoute`) owns the guard, the sending state, Escape and focus. It is a modal dialog named
 * by the form's title on both viewports. On a computer it is the design's modal
 * (`CobroCompu.dc.html`): a backdrop and the dialog over it; on a phone it is the sheet
 * (`Cobro.dc.html`): anchored to the bottom, rounded at the top, with a grab handle and the screen it
 * was opened from showing faded above it, and no backdrop to click. Both are the same elements
 * (`main > .cuerpo`), only the class and the backdrop listener differ, so a resize across 900
 * px keeps what was typed. `children` render beside the dialog, never inside it (the leave confirmation).
 * The same shape as `PriceFrame` (ADR-0044).
 */

import { type ReactNode, useEffect, useRef } from 'react'

export interface CobroFrameProps {
  /** True on a computer: the dialog sits over a backdrop that closes it. On a phone it is a sheet. */
  computer: boolean
  /** The id of the element that holds the dialog's title; without one, `label` names it. */
  titleId?: string
  label?: string
  /** A click on the backdrop itself (never on the dialog). */
  onBackdrop: () => void
  /** The form (inside the dialog) and, after it, what sits beside the dialog. */
  form: ReactNode
  children?: ReactNode
}

export default function CobroFrame({ computer, titleId, label, onBackdrop, form, children }: CobroFrameProps) {
  // The backdrop is a pointer convenience, not a control: a keyboard user leaves by Escape
  // or "Cerrar". So it is a native listener, not a click handler the control scan would read
  // as a control without a name, a role or a pressed state.
  const frame = useRef<HTMLElement>(null)
  useEffect(() => {
    const element = frame.current
    if (!computer || element === null) return
    function onClick(event: MouseEvent): void {
      if (event.target === element) onBackdrop()
    }
    element.addEventListener('click', onClick)
    return () => element.removeEventListener('click', onClick)
  }, [computer, onBackdrop])
  return (
    <main ref={frame} className={computer ? 'pantalla cobro-modal' : 'pantalla cobro-hoja'}>
      <div
        className="cuerpo"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-label={titleId === undefined ? label : undefined}
      >
        {!computer && <span className="cobro-hoja__asa" aria-hidden="true" />}
        {form}
      </div>
      {children}
    </main>
  )
}
