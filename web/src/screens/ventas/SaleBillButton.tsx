/**
 * `SaleBillButton`: Share or Copy of the sale bill, on the sale's detail (`sales.md`, "Sale
 * bill"). It draws what `useSaleBillShare` returns for the `bill` of the last `GET /sales/{id}`
 * it was handed and never works settlement out. `loading` is an explicit state, never a missing
 * bill: the button then keeps its label, is disabled and busy, and draws no digit or `$`. A
 * `null` bill draws nothing. The tap logic (synchronous call inside the gesture, one pending
 * ref, sequence number, release on visibility) lives in the hook.
 */

import AvisoAmbar from '../../components/AvisoAmbar'
import Boton from '../../components/Boton'
import { SALE_BILL_TEXT } from '../../copy/sales'
import { useSaleBillShare } from '../../sales/useSaleBillShare'
import type { SaleBillButtonState } from '../../sales/useSaleBillShare'

export type { SaleBillButtonState }

export interface SaleBillButtonProps {
  state: SaleBillButtonState
  /** True while the detail is being read again after a write that changes the bill. */
  refreshing: boolean
  /** The copy worked: the screen shows its toast. */
  onCopied: () => void
}

export default function SaleBillButton({ state, refreshing, onCopied }: SaleBillButtonProps) {
  const { sharing, busy, onTap, failure } = useSaleBillShare({ state, refreshing, onCopied })

  if (state.kind === 'ready' && state.bill === null) return null

  const label = sharing ? SALE_BILL_TEXT.share : SALE_BILL_TEXT.copy
  const icon = sharing ? 'compartir' : 'copiar'

  return (
    <div className="sale-bill">
      <Boton
        variant="secondary"
        icon={icon}
        disabled={busy}
        ariaBusy={busy ? true : undefined}
        onClick={onTap}
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
    </div>
  )
}
