/** The two reasons by their word on screen (`CONTEXT.md`: Promoción, Consumo propio). */

import type { WithdrawalReason } from '../../api/stock'

export const REASON_OPTIONS: { value: WithdrawalReason; label: string }[] = [
  { value: 'promotion', label: 'Promoción' },
  { value: 'own_use', label: 'Consumo propio' },
]
