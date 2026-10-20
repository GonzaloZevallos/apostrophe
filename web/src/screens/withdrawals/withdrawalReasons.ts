/** The two reasons by their word on screen (`CONTEXT.md`: Promotion, Own use). */

import type { WithdrawalReason } from '../../api/stock'
import { REASON_OWN_USE, REASON_PROMOTION } from '../../copy/stock'

export const REASON_OPTIONS: { value: WithdrawalReason; label: string }[] = [
  { value: 'promotion', label: REASON_PROMOTION },
  { value: 'own_use', label: REASON_OWN_USE },
]

export const REASON_LABEL: Record<WithdrawalReason, string> = {
  promotion: REASON_PROMOTION,
  own_use: REASON_OWN_USE,
}
