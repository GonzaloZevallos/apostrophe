import { createContext } from 'react'
import type { FlashMessage, FlashOptions } from './flashReducer'

/**
 * Both functions keep one identity for the life of the provider and read the current location
 * when they are called, so a result that arrives late (a resolved promise after `navigate()`)
 * shows on the location the seller is on now. Never raise a toast from a layout effect: the
 * provider records the location in a layout effect of its own, which runs after the children's.
 */
export interface Flash {
  /** Show `message` on the first location after the current one (e.g. after `navigate(-1)`). */
  armAfterLeaving: (message: FlashMessage, options?: FlashOptions) => void
  /** Show `message` right here, on the current location. */
  showNow: (message: FlashMessage, options?: FlashOptions) => void
}

export const FlashContext = createContext<Flash | null>(null)
