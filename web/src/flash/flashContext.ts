import { createContext } from 'react'
import type { SuccessToast } from '../components/AvisoExito'

export interface Flash {
  /** Show `toast` on the first location after the current one (e.g. after `navigate(-1)`). */
  armAfterLeaving: (toast: SuccessToast) => void
  /** Show `toast` right here, on the current location. */
  showNow: (toast: SuccessToast) => void
}

export const FlashContext = createContext<Flash | null>(null)
