/**
 * `CobroPreviewLine`: the line under Record payment's amount that says what the customer will
 * still owe. It shows a figure only when the answer was asked for the amount and date now in the
 * field (`previewIsCurrent`); in every other state it is words with no digit. It always renders the
 * one `.cobro__vista-previa` wrapper, so the sheet's height does not move between states.
 * `fetching` is not an input to the choice: a refresh of a current answer keeps its figure.
 */

import { Trans, useTranslation } from 'react-i18next'
import type { PaymentPreview } from '../../api/payments'
import { AvisoCuerpo } from '../../components/AvisoAmbar'
import { useMoney } from '../../format/moneyContext'
import { previewIsCurrent, type PreviewFailure, type PreviewKey } from './cobroLabels'

export interface CobroPreviewLineProps {
  /** The amount and date in the field now. */
  current: PreviewKey
  /** The answer, always with the key it was asked for. */
  query: { key: PreviewKey; preview: PaymentPreview | undefined; failure: PreviewFailure | null; fetching: boolean }
}

export default function CobroPreviewLine({ current, query }: CobroPreviewLineProps) {
  const { t } = useTranslation()
  const money = useMoney()
  const { preview, failure } = query

  if (current.amount === null) return <p className="cobro__vista-previa" />
  if (!previewIsCurrent(query.key, current)) return <Loading busy />
  if (failure === 'above_balance') return <p className="cobro__vista-previa" />
  if (failure === 'offline') return <Loading busy={false} />
  if (failure === 'other') {
    return (
      <p className="cobro__vista-previa">
        <AvisoCuerpo attention>{t('payments:previewFailed')}</AvisoCuerpo>
      </p>
    )
  }
  if (preview === undefined) return <Loading busy />
  if (preview.after.standing !== 'owes') return <p className="cobro__vista-previa">{t('payments:previewSettled')}</p>
  return (
    <p className="cobro__vista-previa">
      <Trans
        i18nKey="payments:previewStillOwe"
        values={{ amount: money.money(preview.after.balance) }}
        components={{ amount: <strong className="cifra-n" /> }}
      />
    </p>
  )
}

function Loading({ busy }: { busy: boolean }) {
  const { t } = useTranslation()
  return (
    <p className="cobro__vista-previa" aria-busy={busy ? 'true' : undefined}>
      {t('payments:previewLoading')}
    </p>
  )
}
