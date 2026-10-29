/**
 * `CobroFrame`: what surrounds Registrar cobro's form. Presentational only: its host
 * (`CobroRoute`) owns the guard, the sending state, Escape and focus. It is a modal dialog named
 * by the form's title on both viewports. On a computer it is the design's modal
 * (`CobroCompu.dc.html`): a backdrop and the dialog over it; on a phone it is a `Sheet`, the full
 * screen form with "Close" on top and Save pinned at the bottom. `Sheet` draws both as the same
 * elements (`main > .cuerpo`), only the class and the backdrop listener differ, so a resize across
 * 900 px keeps what was typed. `children` render beside the dialog, never inside it (the leave
 * confirmation). The same shape as `PriceFrame` (ADR-0044).
 */

import type { ReactNode } from 'react'
import Sheet from '../../components/Sheet'

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
  return (
    <Sheet
      computer={computer}
      computerClass="pantalla cobro-modal"
      computerDialog
      titleId={titleId}
      label={label}
      // The computer modal keeps its backdrop as it was: a click on it is the host's one `leave`,
      // which asks first when something was typed. So the frame never reports itself touched.
      touched={false}
      onClose={onBackdrop}
      aside={children}
    >
      {form}
    </Sheet>
  )
}
