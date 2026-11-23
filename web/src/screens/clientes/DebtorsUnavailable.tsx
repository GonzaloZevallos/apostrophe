/**
 * `DebtorsSlot`: the one always-mounted polite status region of Customers' debtors notice, drawn
 * above the flat list when the owed figures did not load (`customers.md`). The sentence is the
 * button's only text and its accessible name, so a screen reader hears it once, as the slot's
 * content changes: the button is inserted by a passive effect, after `ContentArea`'s layout
 * effect has removed `aria-busy`, and a new failure replaces only the keyed text span, never the
 * button, so its focus stays. While the slot is drawn it reserves the notice's height in the same
 * commit as the rows, so nothing below it moves when the button arrives. A retry in flight keeps
 * the card and the sentence, adding `aria-busy` and `aria-disabled` and nothing else.
 */

import { useEffect, useRef, useState } from 'react'
import Boton from '../../components/Boton'
import Icono from '../../components/Icono'

/** The value of `data-place` while the notice is drawn: where focus lands when a customer's row is gone. */
export const DEBTORS_NOTICE_PLACE = 'debtors-notice'

export interface DebtorsSlotProps {
  /** The screen's whole condition for showing the notice. */
  drawn: boolean
  /** A retry is in flight: the notice stays and reads as busy. */
  busy: boolean
  /** The sentence: the button's only text and its name. Its owner, `Clientes`, holds the copy. */
  sentence: string
  /** The time of the latest failure: a new one re-announces the sentence. */
  errorUpdatedAt: number
  onRetry: () => void
}

export function DebtorsSlot({ drawn, busy, sentence, errorUpdatedAt, onRetry }: DebtorsSlotProps) {
  const [filled, setFilled] = useState(false)
  const region = useRef<HTMLDivElement>(null)
  // After the commit's effects, never inside one: the button arrives once `ContentArea` has dropped `aria-busy`.
  useEffect(() => {
    let live = true
    queueMicrotask(() => {
      if (live) setFilled(drawn)
    })
    return () => {
      live = false
    }
  }, [drawn])
  // Focus that landed on the slot before its button existed (the return to place) moves onto the button.
  useEffect(() => {
    const slot = region.current
    if (drawn && filled && slot !== null && document.activeElement === slot) slot.querySelector('button')?.focus({ preventScroll: true })
  }, [drawn, filled])
  return (
    <div
      ref={region}
      role="status"
      className={drawn ? 'clientes__sin-cifras clientes__sin-cifras--reservado' : 'clientes__sin-cifras'}
      data-place={drawn ? DEBTORS_NOTICE_PLACE : undefined}
      tabIndex={drawn ? -1 : undefined}
    >
      {drawn && filled && (
        <Boton variant="notice" onClick={onRetry} ariaBusy={busy ? true : undefined} ariaDisabled={busy ? true : undefined}>
          <span className="aviso-ambar__icono">
            <Icono nombre="atencion" />
          </span>
          <span key={errorUpdatedAt}>{sentence}</span>
        </Boton>
      )}
    </div>
  )
}
