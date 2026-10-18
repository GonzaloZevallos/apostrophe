/** The fixed Spanish of the low-stock warning's form and switch, and the one table from a
 * refusal of `PUT /stock/varieties/{id}/threshold` to its message. */

import type { RefusalCode } from '../../api/refusals'
import type { LimitedCopy } from '../../copy/limits'
import type { SuccessToast } from '../../components/AvisoExito'

export const THRESHOLD_INVALID_MESSAGE = 'Revisá el umbral cargado'
export const THRESHOLD_SAVED: SuccessToast = 'Aviso guardado'

export const THRESHOLD_OVERRIDES: Partial<Record<RefusalCode, string>> = {
  'stock.threshold_invalid': THRESHOLD_INVALID_MESSAGE,
}

/** No always-visible help line or notice lives here yet. Checked by `copy/copyLimits.test.ts`. */
export const LIMITED_COPY: readonly LimitedCopy[] = []
export const LONG_REFUSALS: readonly string[] = []
