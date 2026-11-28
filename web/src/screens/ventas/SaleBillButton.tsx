/**
 * `SaleBillButton`: the sale bill's Copy on the sale's detail (`sales.md`, "Sale bill"). It only
 * draws what the screen's one `useSaleBillShare` hands it as `share`; it never calls the hook,
 * never works settlement out and never reads Share: the title row owns that tap. The one button
 * always reads Copy, is disabled and busy while `share.busy`, and calls `share.onCopy`. It alone
 * draws the failure notices and the copy-by-hand region. With no bill it draws nothing.
 */

import { useTranslation } from 'react-i18next'
import AvisoAmbar from '../../components/AvisoAmbar'
import Boton from '../../components/Boton'
import type { SaleBillShare } from '../../sales/useSaleBillShare'

export interface SaleBillButtonProps {
  share: SaleBillShare
  /** Whether the sale has a bill to copy. */
  hasBill: boolean
}

export default function SaleBillButton({ share, hasBill }: SaleBillButtonProps) {
  const { t } = useTranslation()
  if (!hasBill) return null

  const { busy, onCopy, failure } = share

  return (
    <div className="sale-bill" role="group" aria-label={t('sales:bill.actionsName')}>
      <Boton
        variant="secondary"
        icon="copiar"
        disabled={busy}
        ariaBusy={busy ? true : undefined}
        onClick={onCopy}
      >
        {t('sales:bill.copy')}
      </Boton>
      {failure !== null && (
        <AvisoAmbar attention role="alert">
          {failure.kind === 'share' ? t('sales:bill.shareFailed') : t('sales:bill.copyFailed')}
        </AvisoAmbar>
      )}
      {failure?.kind === 'copy' && (
        <div className="sale-bill__bloque" role="region" aria-label={t('sales:bill.blockName')}>
          <pre className="sale-bill__texto">{failure.text}</pre>
        </div>
      )}
    </div>
  )
}
