/**
 * The slot behind the offline notice (`offlineBannerSlot.tsx`): a store holding a Set of
 * `useId` tokens, and the two hooks that use it. Shell claims it while mounted, at any width;
 * Root reads whether anybody has. Kept apart from the components so fast refresh stays whole.
 */

import { createContext, useContext, useId, useLayoutEffect, useSyncExternalStore } from 'react'

export interface SlotStore {
  subscribe: (onChange: () => void) => () => void
  isClaimed: () => boolean
  claim: (token: string) => () => void
}

export function createSlotStore(): SlotStore {
  const tokens = new Set<string>()
  const listeners = new Set<() => void>()
  const notify = () => {
    for (const listener of [...listeners]) listener()
  }
  return {
    subscribe: (onChange) => {
      listeners.add(onChange)
      return () => {
        listeners.delete(onChange)
      }
    },
    isClaimed: () => tokens.size > 0,
    claim: (token) => {
      tokens.add(token)
      notify()
      return () => {
        tokens.delete(token)
        notify()
      }
    },
  }
}

/** Outside a provider nobody claims anything: the store is empty and stays so. */
const NO_SLOT: SlotStore = createSlotStore()

export const SlotContext = createContext<SlotStore>(NO_SLOT)

/** Shell: holds the slot while mounted, at any width. */
export function useClaimOfflineBannerSlot(): void {
  const store = useContext(SlotContext)
  const token = useId()
  useLayoutEffect(() => store.claim(token), [store, token])
}

/** Root: whether a Shell holds the slot. */
export function useOfflineBannerSlotClaimed(): boolean {
  const store = useContext(SlotContext)
  return useSyncExternalStore(store.subscribe, store.isClaimed)
}
