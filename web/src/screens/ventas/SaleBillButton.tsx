/**
 * `SaleBillButton`: Share or Copy of the sale bill, on the sale's detail (`sales.md`, "Sale
 * bill"). It renders the text from the `bill` of the last `GET /sales/{id}` it was handed and
 * never works settlement out. `loading` is an explicit state, never a missing bill: the button
 * then keeps its label, is disabled and busy, and draws no digit or `$`. A `null` bill draws
 * nothing.
 *
 * The tap calls `shareText` or `copyText` synchronously, with nothing awaited first: over plain
 * http (ADR-0002) the `execCommand` fallback must run inside the gesture. One synchronous
 * pending ref guards Share and Copy together, and a sequence number decides whose outcome
 * counts: a tap whose answer arrives after a newer tap changes nothing. A share sheet that
 * never settles is released when the page is visible again. Nothing of the bill is stored,
 * logged or written to the console.
 */

import { useEffect, useRef, useState } from 'react'
import type { SaleBill } from '../../api/sales'
import AvisoAmbar from '../../components/AvisoAmbar'
import Boton from '../../components/Boton'
import { copyText } from '../../clipboard'
import { SALE_BILL_TEXT } from '../../copy/sales'
import { canShare, shareText } from '../../share'
import { renderSaleBill } from '../../sales/saleBill'

export type SaleBillButtonState = { kind: 'loading' } | { kind: 'ready'; bill: SaleBill | null }

export interface SaleBillButtonProps {
  state: SaleBillButtonState
  /** True while the detail is being read again after a write that changes the bill. */
  refreshing: boolean
  /** The copy worked: the screen shows its toast. */
  onCopied: () => void
}

type Failure = { kind: 'share' } | { kind: 'copy'; text: string }

export default function SaleBillButton({ state, refreshing, onCopied }: SaleBillButtonProps) {
  const [shareFailed, setShareFailed] = useState(false)
  const [failure, setFailure] = useState<Failure | null>(null)
  const pending = useRef(false)
  const sequence = useRef(0)
  const release = useRef<(() => void) | null>(null)

  useEffect(
    () => () => {
      sequence.current += 1
      release.current?.()
    },
    [],
  )

  if (state.kind === 'ready' && state.bill === null) return null

  const sharing = canShare() && !shareFailed
  const label = sharing ? SALE_BILL_TEXT.share : SALE_BILL_TEXT.copy
  const icon = sharing ? 'compartir' : 'copiar'
  const busy = state.kind === 'loading' || refreshing

  function onClick() {
    if (pending.current || state.kind !== 'ready' || state.bill === null) return
    pending.current = true
    sequence.current += 1
    const tap = sequence.current
    const text = renderSaleBill(state.bill)

    release.current?.()
    const onVisible = () => {
      if (document.visibilityState === 'visible') release.current?.()
    }
    const clear = () => {
      pending.current = false
      document.removeEventListener('visibilitychange', onVisible)
      release.current = null
    }
    release.current = clear
    document.addEventListener('visibilitychange', onVisible)

    setFailure(null)
    // No `await` before either call: the browser credits it to this click.
    if (sharing) {
      void shareText(text).then((outcome) => {
        if (sequence.current !== tap) return
        clear()
        if (outcome === 'failed') {
          setShareFailed(true)
          setFailure({ kind: 'share' })
        }
      })
    } else {
      void copyText(text).then((copied) => {
        if (sequence.current !== tap) return
        clear()
        if (copied) onCopied()
        else setFailure({ kind: 'copy', text })
      })
    }
  }

  return (
    <>
      <Boton
        variant="secondary"
        icon={icon}
        disabled={busy}
        ariaBusy={busy ? true : undefined}
        className="sale-bill__boton"
        onClick={onClick}
      >
        {label}
      </Boton>
      {failure !== null && (
        <AvisoAmbar attention role="alert">
          {failure.kind === 'share' ? SALE_BILL_TEXT.shareFailed : SALE_BILL_TEXT.copyFailed}
        </AvisoAmbar>
      )}
      {failure?.kind === 'copy' && (
        <div className="sale-bill__bloque" role="region" aria-label={SALE_BILL_TEXT.blockName}>
          <pre className="sale-bill__texto">{failure.text}</pre>
        </div>
      )}
    </>
  )
}
