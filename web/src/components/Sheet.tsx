/**
 * `Sheet`: what draws a form on a phone (ADR-0049). Presentational only: its host owns the
 * guard, the sending state, Escape and where the form goes. It always renders the same
 * element tree, `main > div.cuerpo > children` and then `aside` inside `main`, so a resize
 * across 900 px keeps what was typed; `computer` changes only the class, the dialog
 * attributes and whether the backdrop listener is attached.
 *
 * - On a phone the sheet fills the screen (`.sheet`), is a modal dialog named by the form's
 *   title, and has no outside: the form's own Close (pinned to its top) and the system back
 *   are its exits, so nothing here listens for a tap outside. Focus goes to `initialFocus`,
 *   or to the first control in DOM order that can take it, once the form is drawn.
 * - On a computer it is the host's own frame (`computerClass`); with `computerDialog` it is
 *   the design's modal over a backdrop, and a click on the backdrop itself calls `onClose`,
 *   but never while the form is `touched`. It opens no dialog of its own.
 *
 * `aside` renders beside the dialog, never inside it (the leave confirmation, the gone notice).
 */

import { type ReactNode, type RefObject, useEffect, useRef } from 'react'

export interface SheetProps {
  /** True on a computer: the frame is the host's `computerClass`. */
  computer: boolean
  /** The classes `main` takes on a computer, e.g. `pantalla cobro-modal`. */
  computerClass: string
  /** True when the computer frame is a modal dialog; a phone sheet always is. */
  computerDialog: boolean
  /** The id of the element that holds the dialog's title; without one, `label` names it. */
  titleId?: string
  label?: string
  /** Whether the form holds something typed: the host's `dirty`, the one `useLeaveGuard` reads. */
  touched: boolean
  /** A click on the computer backdrop itself, while untouched. */
  onClose: () => void
  /** The control that takes focus on a phone, instead of the first one. */
  initialFocus?: RefObject<HTMLElement | null>
  /** The form (inside the dialog). */
  children?: ReactNode
  /** What sits beside the dialog. */
  aside?: ReactNode
}

const CONTROLS = 'input, select, textarea, button'

/** A control inside a closed details' own `summary` is still reachable. */
function isInSummary(control: HTMLElement, details: HTMLDetailsElement): boolean {
  const summary = details.querySelector(':scope > summary')
  return summary !== null && summary.contains(control)
}

/** A control that is neither disabled nor hidden, inert, aria-hidden or inside a closed details. */
function canTakeFocus(control: HTMLElement): boolean {
  if (control.matches(':disabled') || control.closest('[hidden], [inert], [aria-hidden="true"]') !== null) return false
  if (control instanceof HTMLInputElement && control.type === 'hidden') return false
  for (let node: HTMLElement | null = control; node !== null; node = node.parentElement) {
    if (getComputedStyle(node).display === 'none') return false
    if (node instanceof HTMLDetailsElement && !node.open && !isInSummary(control, node)) return false
  }
  return true
}

/** The first control of the form (the form's own Close, above it, is not one), or of the body when none. */
function firstControl(root: HTMLElement): HTMLElement | null {
  const scope = root.querySelector('form') ?? root
  for (const control of scope.querySelectorAll<HTMLElement>(CONTROLS)) {
    if (canTakeFocus(control)) return control
  }
  return null
}

export default function Sheet({
  computer,
  computerClass,
  computerDialog,
  titleId,
  label,
  touched,
  onClose,
  initialFocus,
  children,
  aside,
}: SheetProps) {
  // The backdrop is a pointer convenience, not a control: a keyboard user leaves by Escape
  // or Close. So it is a native listener, not a click handler the control scan would read
  // as a control without a name, a role or a pressed state.
  const frame = useRef<HTMLElement>(null)
  const body = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const element = frame.current
    if (!computer || !computerDialog || touched || element === null) return
    function onClick(event: MouseEvent): void {
      if (event.target === element) onClose()
    }
    element.addEventListener('click', onClick)
    return () => element.removeEventListener('click', onClick)
  }, [computer, computerDialog, touched, onClose])

  // Focus once, when the phone sheet first holds a control: the host may draw a loading state
  // first and the form after. A sheet that mounted on a computer never takes it, so a resize
  // across 900 px does not steal focus from what is being typed.
  const settled = useRef(computer)
  useEffect(() => {
    if (settled.current || computer || body.current === null) return
    const target = initialFocus?.current ?? firstControl(body.current)
    if (target === null) return
    settled.current = true
    target.focus({ preventScroll: true })
  })

  return (
    <main ref={frame} className={computer ? computerClass : 'pantalla sheet'}>
      <div
        ref={body}
        className={computer ? 'cuerpo' : 'cuerpo sheet__body'}
        role={computer && !computerDialog ? undefined : 'dialog'}
        aria-modal={computer && !computerDialog ? undefined : true}
        aria-labelledby={computer && !computerDialog ? undefined : titleId}
        aria-label={computer && !computerDialog ? undefined : titleId === undefined ? label : undefined}
      >
        {children}
      </div>
      {aside}
    </main>
  )
}
