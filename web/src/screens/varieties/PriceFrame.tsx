/**
 * `PriceFrame`: what surrounds the price form. Presentational only: its host (`PriceNew`)
 * owns the guard, the sending state, Escape and focus. On a computer it is the
 * design's modal (`PrecioNuevoCompu.dc.html`): a backdrop and a dialog named by the form's
 * title; on a phone it is the full form screen. Both are the same elements (`main > .cuerpo`),
 * only attributes and classes differ, so a resize across 900 px keeps what was typed.
 * `children` render beside the dialog, never inside it (the leave confirmation).
 */

import type { MouseEvent, ReactNode } from 'react'

export interface PriceFrameProps {
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

export default function PriceFrame({ dialog, titleId, label, onBackdrop, form, children }: PriceFrameProps) {
  function onClick(event: MouseEvent<HTMLElement>): void {
    if (dialog && event.target === event.currentTarget) onBackdrop()
  }
  return (
    <main className={dialog ? 'pantalla precio-modal' : 'pantalla'} onClick={onClick}>
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
