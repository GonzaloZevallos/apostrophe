/**
 * `PriceFrame`: what surrounds the price form. Presentational only: its host (`PriceNew`)
 * owns the guard, the sending state, Escape and focus. On a computer it is the
 * design's modal (`PrecioNuevoCompu.dc.html`): a backdrop and a dialog named by the form's
 * title (ADR-0044); on a phone it is a `Sheet`, the full form screen. `Sheet` draws both as the
 * same elements (`main > .cuerpo`), so a resize across 900 px keeps what was typed.
 * `children` render beside the dialog, never inside it (the leave confirmation).
 */

import type { ReactNode } from 'react'
import Sheet from '../../components/Sheet'

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
  return (
    <Sheet
      computer={dialog}
      computerClass="pantalla precio-modal"
      computerDialog
      titleId={titleId}
      label={label}
      // ADR-0044's modal keeps its backdrop as it was: a click on it is the host's one `leave`, which
      // asks first when something was typed. So the frame never reports itself touched.
      touched={false}
      onClose={onBackdrop}
      aside={children}
    >
      {form}
    </Sheet>
  )
}
