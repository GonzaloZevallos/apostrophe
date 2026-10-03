/**
 * The single `QueryClient` the app renders with (plan, "Server state"). A 401 from
 * any gated query or mutation is a session boundary (plan, "Session"; invariants): it
 * clears the cache and sends the person back to Entrar, through the same
 * `handleUnauthorized` every other boundary uses — not a per-screen concern, so a
 * screen subtask's own saves and deletes get it for free from mounting under the
 * gated layout, without wiring a 401 check into every mutation.
 *
 * `handleUnauthorized` needs the current path and a navigate function; neither lives
 * outside the router, so `setCurrentPath`/`setNavigate` let the router keep them
 * current (`App.tsx`'s `RouterSync`). Before the router has mounted once, there is no
 * navigate function yet and a 401 does nothing — the same as on a public route.
 */

import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query'
import { ApiError } from './api/client'
import { handleUnauthorized } from './session'

let currentPath = '/'
let navigateRef: ((path: string) => void) | null = null

export function setCurrentPath(path: string): void {
  currentPath = path
}

export function setNavigate(fn: (path: string) => void): void {
  navigateRef = fn
}

function onError(error: unknown): void {
  if (error instanceof ApiError && error.status === 401 && navigateRef !== null) {
    handleUnauthorized({ queryClient, navigate: navigateRef }, currentPath)
  }
}

export const queryClient: QueryClient = new QueryClient({
  queryCache: new QueryCache({ onError }),
  mutationCache: new MutationCache({ onError }),
  // No silent background retry: the product's own retry is explicit — the offline
  // banner's "reintentamos solos cuando vuelva" fires on the browser's own `online`
  // event (`useOnline.ts`), not a hidden exponential backoff. Without this, a gated
  // query's error state (`GatedLayout`'s "Sin conexión"/generic retry) would only
  // appear after react-query's default few seconds of retries.
  defaultOptions: { queries: { retry: false } },
})
