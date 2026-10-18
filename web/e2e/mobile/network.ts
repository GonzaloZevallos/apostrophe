/**
 * The network rules of the mobile project (invariant 6): no non-GET/HEAD request reaches
 * the backend — it ends in `abort()` or a stubbed `fulfill`, never `continue` — and the
 * held-API mode keeps GET API answers back until the spec releases them by signal.
 */

import type { BrowserContext, Request, Route } from '@playwright/test'
import type { ReadStub, WriteStub } from '../../src/mobile-standard/states.ts'

const READS = new Set(['GET', 'HEAD'])

/**
 * Opening an invitation or a reset link signs the device out first (`session.ts`'s
 * `openInvitation`, `openResetLink`): an aborted logout would show "Sin conexión" in place
 * of the screen. Its stub answers 204 and drops no cookie, so the shared session survives.
 */
export const LOGOUT_STUB: WriteStub = { method: 'POST', path: /^\/auth\/logout$/, status: 204 }

/** Takes a route off its context; every route this module adds returns one. */
export type Undo = () => Promise<void>

export async function guardWrites(context: BrowserContext, stubs: readonly WriteStub[] = []): Promise<Undo> {
  const handler = async (route: Route): Promise<void> => {
    const request = route.request()
    if (READS.has(request.method())) {
      await route.fallback()
      return
    }
    const { pathname } = new URL(request.url())
    const stub = [LOGOUT_STUB, ...stubs].find((s) => s.method === request.method() && s.path.test(pathname))
    if (stub === undefined) {
      await route.abort()
      return
    }
    await route.fulfill(
      stub.status === 204
        ? { status: 204 }
        : { status: stub.status, contentType: 'application/json', body: JSON.stringify(stub.body ?? {}) },
    )
  }
  await context.route('**/*', handler)
  return () => context.unroute('**/*', handler)
}

/** Answers the fetch and xhr GETs `stubs` name with their status; pages, assets and every other request fall through (a front path such as /sales is also an API path). */
export async function stubReads(context: BrowserContext, stubs: readonly ReadStub[]): Promise<Undo> {
  const handler = async (route: Route): Promise<void> => {
    const request = route.request()
    const { pathname } = new URL(request.url())
    const stub = request.method() === 'GET' && ['fetch', 'xhr'].includes(request.resourceType()) ? stubs.find((s) => s.path.test(pathname)) : undefined
    if (stub === undefined) {
      await route.fallback()
      return
    }
    await route.fulfill({
      status: stub.status,
      contentType: 'application/json',
      body: JSON.stringify(stub.body ?? {}),
    })
  }
  await context.route('**/*', handler)
  return () => context.unroute('**/*', handler)
}

export interface Held {
  /** Requests held so far. */
  readonly count: () => number
  /** Answers whether a request was held within `ms`: a screen that never fetches has no loading state to read. */
  whenHeld: (ms: number) => Promise<boolean>
  /** Lets every held and every later answer through: the signal, never a timer. */
  release: () => Promise<void>
}

/**
 * The session's own question: held, the gated layout renders nothing and no screen's own
 * loading state could ever be read, so it is the one GET the hold lets through.
 */
const SESSION_PATH = '/auth/me'

/** Holds `wanted` requests until `release()`; the rest pass. `onRelease` is what a released request then does. */
async function holdRequests(
  context: BrowserContext,
  wanted: (request: Request) => boolean,
  onRelease: (route: Route) => Promise<void>,
): Promise<Held> {
  let held = 0
  let open = false
  let go: () => void = () => {}
  let first: () => void = () => {}
  const signal = new Promise<void>((resolve) => {
    go = resolve
  })
  const firstHeld = new Promise<boolean>((resolve) => {
    first = () => resolve(true)
  })
  const handler = async (route: Route): Promise<void> => {
    if (!wanted(route.request()) || open) {
      await route.fallback()
      return
    }
    held += 1
    first()
    await signal
    await onRelease(route)
  }
  await context.route('**/*', handler)
  return {
    count: () => held,
    whenHeld: (ms) =>
      Promise.race([
        firstHeld,
        new Promise<boolean>((resolve) => {
          setTimeout(() => resolve(held > 0), ms)
        }),
      ]),
    release: async () => {
      open = true
      go()
      // The hold is over: take its route off so a long cell does not stack one per walk.
      await context.unroute('**/*', handler)
    },
  }
}

/** Holds every GET `fetch`/`xhr` request but the session's until `release()`; pages and assets pass. */
export function holdApi(context: BrowserContext): Promise<Held> {
  return holdRequests(
    context,
    (request) =>
      request.method() === 'GET' &&
      ['fetch', 'xhr'].includes(request.resourceType()) &&
      new URL(request.url()).pathname !== SESSION_PATH,
    (route) => route.fallback(),
  )
}

/**
 * Holds one write until `release()`, then aborts it: the seller's tap is pending while
 * the request is out, and the backend never receives it (invariant 6).
 */
export function holdWrite(context: BrowserContext, method: string, path: RegExp): Promise<Held> {
  return holdRequests(
    context,
    (request) => request.method() === method && path.test(new URL(request.url()).pathname),
    (route) => route.abort(),
  )
}
