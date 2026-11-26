/**
 * `useSaleBillShare`: the tap logic of the sale bill's Share or Copy button (`sales.md`, "Sale
 * bill"), apart from what it draws. It renders the text from the `bill` it is handed and never
 * works settlement out. `loading` is an explicit state, never a missing bill.
 *
 * The tap calls `shareText` or `copyText` synchronously, with nothing awaited first: over plain
 * http (ADR-0002) the `execCommand` fallback must run inside the gesture. One synchronous
 * pending ref guards Share and Copy together, and a sequence number decides whose outcome
 * counts: a tap whose answer arrives after a newer tap changes nothing. A share sheet that
 * never settles is released when the page is visible again. Nothing of the bill is stored,
 * logged or written to the console. It reads no text: the label, the icon and the lines the
 * failures show belong to the caller.
 */

import { useEffect, useRef, useState } from 'react'
import type { SaleBill } from '../api/sales'
import { copyText } from '../clipboard'
import { canShare, shareText } from '../share'
import { renderSaleBill } from './saleBill'

export type SaleBillButtonState = { kind: 'loading' } | { kind: 'ready'; bill: SaleBill | null }

export type SaleBillFailure = { kind: 'share' } | { kind: 'copy'; text: string }

export interface UseSaleBillShareInput {
  state: SaleBillButtonState
  /** True while the detail is being read again after a write that changes the bill. */
  refreshing: boolean
  /** The copy worked: the screen shows its toast. */
  onCopied: () => void
}

export interface SaleBillShare {
  /** Whether the tap shares (true) or copies (false). */
  sharing: boolean
  /** The bill is loading or being read again: the tap is not available. */
  busy: boolean
  onTap: () => void
  failure: SaleBillFailure | null
}

export function useSaleBillShare({ state, refreshing, onCopied }: UseSaleBillShareInput): SaleBillShare {
  const [shareFailed, setShareFailed] = useState(false)
  const [failure, setFailure] = useState<SaleBillFailure | null>(null)
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

  const sharing = canShare() && !shareFailed
  const busy = state.kind === 'loading' || refreshing

  function onTap() {
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

  return { sharing, busy, onTap, failure }
}
