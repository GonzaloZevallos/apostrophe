/**
 * `CobroFrame`: what surrounds Registrar cobro's form. Presentational only: its host
 * (`CobroRoute`) owns the guard, the sending state, Escape and focus. On a computer it is the
 * design's modal (`CobroCompu.dc.html`): a backdrop and a dialog named by the form's title; on
 * a phone it is the full form screen (`Cobro.dc.html`). Both are the same elements
 * (`main > .cuerpo`), only attributes and classes differ, so a resize across 900 px keeps what
 * was typed. `children` render beside the dialog, never inside it (the leave confirmation).
 * The same shape as `PriceFrame` (ADR-0044).
 */

import { type ReactNode, useEffect, useRef } from 'react'

export interface CobroFrameProps {
  /** True on a computer: the frame is a modal dialog. */
  dialog: boolean
  /** The id of the element that holds the dialog's title; without one, `label` names it. */
  titleId?: string
  label?: string
  /** A click on the backdrop itself (never on the dialog). */
  onBackdrop: () => void
  /** The form (inside the dialog) and, after it, what sits beside the dialog. */
  form: ReactNode
  children?: ReactNode
}

export default function CobroFrame({ dialog, titleId, label, onBackdrop, form, children }: CobroFrameProps) {
  // The backdrop is a pointer convenience, not a control: a keyboard user leaves by Escape
  // or "Cerrar". So it is a native listener, not a click handler the control scan would read
  // as a control without a name, a role or a pressed state.
  const frame = useRef<HTMLElement>(null)
  useEffect(() => {
    const element = frame.current
    if (!dialog || element === null) return
    function onClick(event: MouseEvent): void {
      if (event.target === element) onBackdrop()
    }
    element.addEventListener('click', onClick)
    return () => element.removeEventListener('click', onClick)
  }, [dialog, onBackdrop])
  return (
    <main ref={frame} className={dialog ? 'pantalla cobro-modal' : 'pantalla'}>
      <div
        className="cuerpo"
        role={dialog ? 'dialog' : undefined}
        aria-modal={dialog ? true : undefined}
        aria-labelledby={dialog ? titleId : undefined}
        aria-label={dialog && titleId === undefined ? label : undefined}
      >
        {form}
      </div>
      {children}
    </main>
  )
}
