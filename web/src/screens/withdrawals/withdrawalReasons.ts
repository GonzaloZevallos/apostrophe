/** The two reasons by their word on screen (`CONTEXT.md`: Promoción, Consumo propio). */

import type { WithdrawalReason } from '../../api/stock'
import { PROMOTION_LABEL, OWN_USE_LABEL } from '../../copy/analysis'

export const REASON_OPTIONS: { value: WithdrawalReason; label: string }[] = [
  { value: 'promotion', label: PROMOTION_LABEL },
  { value: 'own_use', label: OWN_USE_LABEL },
]

export const REASON_LABEL: Record<WithdrawalReason, string> = {
  promotion: PROMOTION_LABEL,
  own_use: OWN_USE_LABEL,
}
