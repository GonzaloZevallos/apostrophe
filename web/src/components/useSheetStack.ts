/**
 * A sheet's open state is a history entry (ADR-0027). The entry's `state.sheet` is an
 * integer depth: 0 or absent is the form alone, 1 the first sheet over it, 2 a sheet over
 * that one. The system back gesture and a sheet's "Cerrar" are the same move, `close()`,
 * so no screen defines a separate back behaviour for a sheet.
 *
 * One `SheetStackProvider` per screen creates and recognises those entries; no child makes
 * its own stack and nothing here touches `window.history`.
 *
 * Depth is read at call time from the router's own current location (`router.state`),
 * which changes synchronously on a pop. A React state or ref refreshed by an effect could
 * lag a pop the router already did, and a deferred `closeAll()` would then pop an entry
 * that belongs to the form. At depth 0 every close does nothing, and `navigate(0)` (a page
 * reload) is never called.
 *
 * The router is handed over by `SheetRouterProvider`, set where `RouterProvider` is
 * created. `SheetStackProvider` throws without it: there is no other source of depth.
 */

import {
  createContext,
  createElement,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from 'react'
import { type Location, useLocation, useNavigate } from 'react-router'
import { attachGoneNotice } from './goneExit'

/** The `sheet` depth a history state carries: an integer, 0 when absent or not one. */
export function sheetDepth(state: unknown): number {
  if (typeof state !== 'object' || state === null || !('sheet' in state)) return 0
  const { sheet } = state
  return typeof sheet === 'number' && Number.isInteger(sheet) && sheet > 0 ? sheet : 0
}

function withSheet(state: unknown, sheet: number): Record<string, unknown> {
  const rest: Record<string, unknown> =
    typeof state === 'object' && state !== null ? { ...state } : {}
  delete rest.sheet
  return sheet > 0 ? { ...rest, sheet } : rest
}

/** What the stack needs of a data router: its current location, read synchronously. */
export interface RouterHandle {
  state: { location: Location }
  subscribe: (listener: (state: { location: Location }) => void) => () => void
}

const RouterContext = createContext<RouterHandle | null>(null)

export function SheetRouterProvider({
  router,
  children,
}: {
  router: RouterHandle
  children: ReactNode
}) {
  // The gone notice follows the same router (`goneNotice.ts`).
  useEffect(() => attachGoneNotice(router), [router])
  return createElement(RouterContext.Provider, { value: router }, children)
}

interface Book {
  keys: Record<string, number>
  pending: number | null
}

function createBookStore() {
  let snapshot: Book = { keys: {}, pending: null }
  const listeners = new Set<() => void>()
  return {
    get: () => snapshot,
    set: (next: Book) => {
      snapshot = next
      listeners.forEach((listener) => listener())
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}

interface SheetStack {
  /** Depth of the current entry, orphans excluded: what is on screen. */
  depth: number
  push: () => void
  pop: () => void
  popAll: () => void
}

const StackContext = createContext<SheetStack | null>(null)

export function SheetStackProvider({ children }: { children: ReactNode }) {
  const router = useContext(RouterContext)
  const location = useLocation()
  const navigate = useNavigate()
  if (router === null) throw new Error('SheetStackProvider needs a SheetRouterProvider above it')

  // What this provider pushed and is still on the stack, and the depth of an `open()` whose
  // entry has not reached `location` yet. It decides what renders (`isOpen`): an orphan must
  // never flash a sheet open.
  const [store] = useState(createBookStore)
  const book = useSyncExternalStore(store.subscribe, store.get)

  const readDepth = useCallback(() => sheetDepth(router.state.location.state), [router])

  const rawDepth = sheetDepth(location.state)
  const isOrphan = rawDepth > 0 && !(location.key in book.keys) && book.pending !== rawDepth
  const depth = isOrphan ? 0 : rawDepth

  useEffect(() => {
    const now = store.get()
    const kept = Object.fromEntries(
      Object.entries(now.keys).filter(([, keyDepth]) => keyDepth <= rawDepth),
    )
    const pruned = Object.keys(kept).length !== Object.keys(now.keys).length
    if (rawDepth === 0 || location.key in now.keys) {
      const clearPending = rawDepth === 0 && now.pending !== null
      if (pruned || clearPending) {
        store.set({ keys: kept, pending: clearPending ? null : now.pending })
      }
      return
    }
    if (now.pending === rawDepth) {
      store.set({ keys: { ...kept, [location.key]: rawDepth }, pending: null })
      return
    }
    // Reload, or forward into an entry that was closed: nothing opened it, so clear it.
    void navigate(
      { pathname: location.pathname, search: location.search, hash: location.hash },
      { replace: true, state: withSheet(location.state, 0) },
    )
  }, [rawDepth, location, store, navigate])

  const push = useCallback(() => {
    const current = router.state.location
    const next = sheetDepth(current.state) + 1
    store.set({ ...store.get(), pending: next })
    void navigate(
      { pathname: current.pathname, search: current.search, hash: current.hash },
      { state: withSheet(current.state, next) },
    )
  }, [router, navigate, store])

  const pop = useCallback(() => {
    if (readDepth() > 0) void navigate(-1)
  }, [readDepth, navigate])

  const popAll = useCallback(() => {
    const current = readDepth()
    if (current > 0) void navigate(-current)
  }, [readDepth, navigate])

  const value = useMemo(() => ({ depth, push, pop, popAll }), [depth, push, pop, popAll])
  return createElement(StackContext.Provider, { value }, children)
}

export interface Sheet {
  isOpen: boolean
  open: () => void
  close: () => void
  closeAll: () => void
}

/** The sheet at `level` (1 is the first over the form). Throws outside a provider. */
export function useSheet(level: number): Sheet {
  const stack = useContext(StackContext)
  if (stack === null) throw new Error('useSheet needs a SheetStackProvider')
  const { depth, push, pop, popAll } = stack
  return { isOpen: depth >= level, open: push, close: pop, closeAll: popAll }
}
