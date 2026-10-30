/**
 * `watchScroll(router, deps)` at its seam: a real memory router, the viewport, the page's
 * offset and the pinned reading injected. What it stores is read back through `decisionFor`
 * and `offsetFor`, the way `ScrollSync` reads it.
 */

import { createMemoryRouter, type RouteObject } from 'react-router'
import { afterEach, beforeEach, expect, test } from 'vitest'
import { CUSTOMER, CUSTOMER_PAYMENT, CUSTOMERS, HOME, SALE, SALES, pathTo, type Viewport } from '../routes'
import { browserWatchDeps, decisionFor, noteViewport, offsetFor, resetPlaces, watchScroll, type WatchDeps } from './scrollPlaces'

const ROUTES: RouteObject[] = [{ path: '*', element: null }]

interface Page {
  viewport: Viewport
  scrollY: number
  pinned: boolean
}

let page: Page
let stops: Array<() => void> = []

function deps(): WatchDeps {
  return { viewport: () => page.viewport, scrollY: () => page.scrollY, isPinned: () => page.pinned }
}

function watched(initial: string) {
  const router = createMemoryRouter(ROUTES, { initialEntries: [initial] })
  stops.push(watchScroll(router, deps()))
  return router
}

function currentKey(router: ReturnType<typeof watched>): string {
  return router.state.location.key
}

beforeEach(() => {
  page = { viewport: 'phone', scrollY: 0, pinned: false }
})

afterEach(() => {
  for (const stop of stops) stop()
  stops = []
  resetPlaces()
})

test('a tab opens at the top and the screen left keeps the offset it was at, under its own key', async () => {
  const router = watched(SALES)
  const left = currentKey(router)
  page.scrollY = 700
  await router.navigate(CUSTOMERS)
  expect(decisionFor(currentKey(router))).toBe('top')
  expect(offsetFor(left)).toBe(700)
})

test('a POP to a different path restores, and the entry left on the way back is saved too', async () => {
  const router = watched(SALES)
  const sales = currentKey(router)
  page.scrollY = 700
  await router.navigate(pathTo(SALE, { id: 3 }))
  const detail = currentKey(router)
  page.scrollY = 40
  await router.navigate(-1)
  expect(currentKey(router)).toBe(sales)
  expect(decisionFor(sales)).toBe('restore')
  expect(offsetFor(sales)).toBe(700)
  expect(offsetFor(detail)).toBe(40)
})

test('a same-path PUSH (search, filters) keeps the page', async () => {
  const router = watched(SALES)
  page.scrollY = 300
  await router.navigate(`${SALES}?q=rosa`)
  expect(decisionFor(currentKey(router))).toBe('keep')
})

test('the computer keeps the list when a row is picked in its two panes; the phone opens the card at the top', async () => {
  page.viewport = 'computer'
  const computer = watched(CUSTOMERS)
  await computer.navigate(pathTo(CUSTOMER, { id: 3 }))
  expect(decisionFor(currentKey(computer))).toBe('keep')

  page.viewport = 'phone'
  const phone = watched(CUSTOMERS)
  await phone.navigate(pathTo(CUSTOMER, { id: 3 }))
  expect(decisionFor(currentKey(phone))).toBe('top')
})

test('a sheet over the page: the offset saved when it closes is the held one, never the pinned live reading', async () => {
  const router = watched(CUSTOMERS)
  const list = currentKey(router)
  page.scrollY = 900
  await router.navigate(pathTo(CUSTOMER_PAYMENT, { id: 3 }))
  const sheet = currentKey(router)
  expect(decisionFor(sheet)).toBe('keep')

  // The page is pinned under the sheet: the document reads 0, not the seller's place.
  page.pinned = true
  page.scrollY = 0
  await router.navigate(-1)
  expect(currentKey(router)).toBe(list)
  expect(offsetFor(sheet)).toBe(900)
})

test("a pinned leave with nothing held saves nothing, rather than another screen's offset", async () => {
  const router = watched(HOME)
  page.scrollY = 500
  await router.navigate(SALES)
  const sales = currentKey(router)
  page.pinned = true
  page.scrollY = 0
  await router.navigate(CUSTOMERS)
  expect(offsetFor(sales)).toBeUndefined()
})

test('a change that is not a new entry (a revalidation) decides nothing', async () => {
  const router = watched(SALES)
  const key = currentKey(router)
  await router.revalidate()
  expect(decisionFor(key)).toBeUndefined()
})

test('stopping the watch stops the decisions', async () => {
  const router = createMemoryRouter(ROUTES, { initialEntries: [SALES] })
  const stop = watchScroll(router, deps())
  stop()
  await router.navigate(CUSTOMERS)
  expect(decisionFor(currentKey(router))).toBeUndefined()
})

test("the browser deps read the layout ScrollSync last drew", () => {
  noteViewport('computer')
  expect(browserWatchDeps().viewport()).toBe('computer')
  noteViewport('phone')
  expect(browserWatchDeps().viewport()).toBe('phone')
})
