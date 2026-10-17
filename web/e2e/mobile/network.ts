/**
 * The network rules of the mobile project (invariant 6): no non-GET/HEAD request reaches
 * the backend — it ends in `abort()` or a stubbed `fulfill`, never `continue` — and the
 * held-API mode keeps GET API answers back until the spec releases them by signal.
 */

import type { BrowserContext, Route } from '@playwright/test'

export interface WriteStub {
  method: string
  /** Matched against the request's path. */
  path: RegExp
  status: number
  body?: unknown
}

const READS = new Set(['GET', 'HEAD'])

export async function guardWrites(context: BrowserContext, stubs: readonly WriteStub[] = []): Promise<void> {
  await context.route('**/*', async (route: Route) => {
    const request = route.request()
    if (READS.has(request.method())) {
      await route.fallback()
      return
    }
    const { pathname } = new URL(request.url())
    const stub = stubs.find((s) => s.method === request.method() && s.path.test(pathname))
    if (stub === undefined) {
      await route.abort()
      return
    }
    await route.fulfill({
      status: stub.status,
      contentType: 'application/json',
      body: JSON.stringify(stub.body ?? {}),
    })
  })
}

export interface Held {
  /** GET API requests held so far. */
  readonly count: () => number
  /** Lets every held and every later answer through: the signal, never a timer. */
  release: () => Promise<void>
}

/** Holds every GET `fetch`/`xhr` request until `release()`; pages and assets pass. */
export async function holdApi(context: BrowserContext): Promise<Held> {
  let held = 0
  let open = false
  let go: () => void = () => {}
  const signal = new Promise<void>((resolve) => {
    go = resolve
  })
  const handler = async (route: Route): Promise<void> => {
    const request = route.request()
    const isApi = request.method() === 'GET' && ['fetch', 'xhr'].includes(request.resourceType())
    if (!isApi || open) {
      await route.fallback()
      return
    }
    held += 1
    await signal
    await route.fallback()
  }
  await context.route('**/*', handler)
  return {
    count: () => held,
    release: async () => {
      open = true
      go()
      // The hold is over: take its route off so a long cell does not stack one per walk.
      await context.unroute('**/*', handler)
    },
  }
}
