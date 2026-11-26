/**
 * The context of `ConfirmLayer` and its hook, apart from the component so the component file only
 * exports a component.
 */

import { createContext, useContext } from 'react'

export interface ConfirmLayerApi {
  register: (id: string, root: HTMLElement) => void
  release: (id: string) => void
  isTop: (id: string) => boolean
  host: HTMLElement | null
}

export const ConfirmLayerContext = createContext<ConfirmLayerApi | null>(null)
/** Counts register/release calls, so a reader of `isTop` re-renders when the stack changes. */
export const StackVersionContext = createContext(0)

/**
 * The layer's API, or `null` when no provider is mounted (the dialog then renders in place). The
 * api object is stable across stack changes; the reader re-renders on them so `isTop` is fresh.
 */
export function useConfirmLayer(): ConfirmLayerApi | null {
  useContext(StackVersionContext)
  return useContext(ConfirmLayerContext)
}

