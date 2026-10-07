import { createContext } from 'react'
import type { SuccessToast } from '../components/AvisoExito'

export interface Flash {
  /** Show `toast` on the first location after the current one (e.g. after `navigate(-1)`). */
  armAfterLeaving: (toast: SuccessToast) => void
  /** Show `toast` right here, on the current location. */
  showNow: (toast: SuccessToast) => void
  /** The toast on screen survives the next location change only: a screen that replaces
   * itself with the page it selects (a computer's list) must not dismiss it. */
  keepAcrossReplace: () => void
}

export const FlashContext = createContext<Flash | null>(null)
