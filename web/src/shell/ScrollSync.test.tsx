/**
 * `ScrollSync` under a memory router and StrictMode, with a fake scroller the test drives
 * frame by frame (navigation.md, criteria 21-23; ADR-0068). The page is a stack of empty
 * routes: what is under test is what the owner does to the scroll on each kind of move.
 */

import { act, render } from '@testing-library/react'
import { StrictMode } from 'react'
import { createMemoryRouter, Outlet, RouterProvider } from 'react-router'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { CUSTOMER, CUSTOMER_PAYMENT, CUSTOMERS, HOME, LOGIN, pathTo } from '../routes'
import ScrollSync from './ScrollSync'
import { CEILING_MS, MAX_REMEMBERED, SETTLE_FRAMES, type Scroller } from './scroller'

const VIEWPORT_HEIGHT = 800

/** A scroller whose frames, timers and events are stepped by the test. */
function fakeScroller(initialHeight = 2000) {
  const state = { y: 0, height: initialHeight }
  const scrollListeners = new Set<() => void>()
  const inputListeners = new Set<() => void>()
  let frames: (() => void)[] = []
  const timers = new Map<number, { at: number; run: () => void }>()
  let clock = 0
  let nextTimer = 0
  const scrolls: number[] = []
  const maxY = () => Math.max(0, state.height - VIEWPORT_HEIGHT)

  const scroller: Scroller = {
    y: () => state.y,
    maxY,
    height: () => state.height,
    scrollTo: (top) => {
      scrolls.push(top)
      state.y = Math.min(Math.max(0, top), maxY())
      scrollListeners.forEach((listener) => listener())
    },
    onScroll: (listener) => {
      scrollListeners.add(listener)
      return () => scrollListeners.delete(listener)
    },
    onInput: (listener) => {
      inputListeners.add(listener)
      return () => inputListeners.delete(listener)
    },
    frame: (callback) => {
      frames.push(callback)
      return () => {
        frames = frames.filter((queued) => queued !== callback)
      }
    },
    after: (ms, callback) => {
      const id = nextTimer++
      timers.set(id, { at: clock + ms, run: callback })
      return () => timers.delete(id)
    },
  }

  return {
    scroller,
    scrolls,
    /** The seller scrolls the page to `y`. */
    userScroll(y: number) {
      state.y = y
      scrollListeners.forEach((listener) => listener())
    },
    /** The document becomes `height` tall; the browser clamps the offset and says so. */
    setHeight(height: number) {
      state.height = height
      if (state.y > maxY()) {
        state.y = maxY()
        scrollListeners.forEach((listener) => listener())
      }
    },
    touch() {
      inputListeners.forEach((listener) => listener())
    },
    runFrames(count: number) {
      for (let index = 0; index < count; index += 1) {
        const queued = frames
        frames = []
        queued.forEach((callback) => callback())
      }
    },
    elapse(ms: number) {
      clock += ms
      for (const [id, timer] of [...timers]) {
        if (timer.at <= clock) {
          timers.delete(id)
          timer.run()
        }
      }
    },
    get y() {
      return state.y
    },
    get pendingFrames() {
      return frames.length
    },
  }
}

type Fake = ReturnType<typeof fakeScroller>

function mount(fake: Fake, initial: string | { pathname: string; state?: unknown } = '/a') {
  const router = createMemoryRouter(
    [
      {
        path: '*',
        element: (
          <>
            <ScrollSync scroller={fake.scroller} />
            <Outlet />
          </>
        ),
      },
    ],
    { initialEntries: [initial] },
  )
  render(
    <StrictMode>
      <RouterProvider router={router} />
    </StrictMode>,
  )
  return router
}

async function go(router: ReturnType<typeof mount>, to: string | number, options?: { replace?: boolean; state?: unknown }) {
  await act(async () => {
    if (typeof to === 'number') await router.navigate(to)
    else await router.navigate(to, options)
  })
}

async function frames(fake: Fake, count: number) {
  await act(async () => {
    fake.runFrames(count)
  })
}

const markers: HTMLElement[] = []

/** What `Loading` renders while something loads, found by the scroll owner by its role. */
function startLoading(): HTMLElement {
  const marker = document.createElement('div')
  marker.setAttribute('role', 'progressbar')
  marker.setAttribute('aria-busy', 'true')
  document.body.appendChild(marker)
  markers.push(marker)
  return marker
}

function useComputer(matches: boolean) {
  vi.stubGlobal('matchMedia', () => ({
    matches,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }))
}

beforeEach(() => {
  useComputer(false)
})

afterEach(() => {
  vi.unstubAllGlobals()
  markers.splice(0).forEach((marker) => marker.remove())
})

test('the first mount scrolls nothing and takes the scroll out of the browser\'s hands', () => {
  const fake = fakeScroller()
  fake.userScroll(240)
  mount(fake)

  expect(fake.scrolls).toEqual([])
  expect(fake.y).toBe(240)
  expect(history.scrollRestoration).toBe('manual')
})

test('a push to another screen starts at the top', async () => {
  const fake = fakeScroller()
  const router = mount(fake)
  fake.userScroll(500)

  await go(router, '/b')

  expect(fake.scrolls).toEqual([0])
  expect(fake.y).toBe(0)
})

test('a replace to another screen starts at the top', async () => {
  const fake = fakeScroller()
  const router = mount(fake)
  fake.userScroll(500)

  await go(router, '/b', { replace: true })

  expect(fake.y).toBe(0)
})

test('Entrar to Home starts at the top', async () => {
  const fake = fakeScroller()
  const router = mount(fake, LOGIN)
  fake.userScroll(90)

  await go(router, HOME)

  expect(fake.y).toBe(0)
})

test('a pop restores the offset the screen was left at, once, after the page settled', async () => {
  const fake = fakeScroller()
  const router = mount(fake)
  fake.userScroll(300)
  await go(router, '/b')
  expect(fake.y).toBe(0)

  await go(router, -1)
  expect(fake.y).toBe(0)
  await frames(fake, SETTLE_FRAMES - 1)
  expect(fake.y).toBe(0)
  await frames(fake, 1)

  expect(fake.y).toBe(300)
  expect(fake.scrolls).toEqual([0, 300])
  await frames(fake, 5)
  expect(fake.scrolls).toEqual([0, 300])
  expect(fake.pendingFrames).toBe(0)
})

test('the browser\'s forward restores the screen it returns to', async () => {
  const fake = fakeScroller()
  const router = mount(fake)
  await go(router, '/b')
  fake.userScroll(220)
  await go(router, -1)
  await frames(fake, 4)

  await go(router, 1)
  await frames(fake, 4)

  expect(fake.y).toBe(220)
})

test('a change of search or state on the same path does nothing', async () => {
  const fake = fakeScroller()
  const router = mount(fake)
  fake.userScroll(500)

  await go(router, '/a?page=2')
  await go(router, '/a', { state: { depth: 1 } })
  await go(router, -1)

  expect(fake.scrolls).toEqual([])
  expect(fake.y).toBe(500)
})

test('a clamp that fires its event during the wait does not overwrite the offset', async () => {
  const fake = fakeScroller()
  const router = mount(fake)
  fake.userScroll(300)
  await go(router, '/b')

  await go(router, -1)
  fake.setHeight(400)
  expect(fake.y).toBe(0)
  await frames(fake, 1)
  fake.setHeight(2000)
  await frames(fake, SETTLE_FRAMES + 1)

  expect(fake.y).toBe(300)
})

test('content that arrives after 200 frames is restored, not given up on', async () => {
  const fake = fakeScroller()
  const router = mount(fake)
  fake.userScroll(300)
  await go(router, '/b')
  const loading = startLoading()

  await go(router, -1)
  await frames(fake, 200)
  expect(fake.y).toBe(0)

  loading.remove()
  await frames(fake, SETTLE_FRAMES + 1)

  expect(fake.y).toBe(300)
})

test('a page that settles shorter than the offset lands at its bottom without waiting for the ceiling', async () => {
  const fake = fakeScroller()
  const router = mount(fake)
  fake.userScroll(1000)
  await go(router, '/b')

  await go(router, -1)
  fake.setHeight(1100)
  await frames(fake, SETTLE_FRAMES + 2)

  expect(fake.y).toBe(300)
  expect(fake.pendingFrames).toBe(0)
  fake.elapse(CEILING_MS)
  expect(fake.scrolls).toEqual([0, 300])
})

test('a second Loading after the first does not settle on the first stable frame', async () => {
  const fake = fakeScroller()
  const router = mount(fake)
  fake.userScroll(300)
  await go(router, '/b')
  const first = startLoading()

  await go(router, -1)
  first.remove()
  await frames(fake, SETTLE_FRAMES - 1)
  const second = startLoading()
  await frames(fake, 3)
  expect(fake.y).toBe(0)

  second.remove()
  await frames(fake, SETTLE_FRAMES + 1)

  expect(fake.y).toBe(300)
})

test('a touch during the wait ends it and the seller\'s own position is what is stored', async () => {
  const fake = fakeScroller()
  const router = mount(fake)
  fake.userScroll(300)
  await go(router, '/b')
  await go(router, -1)

  fake.userScroll(40)
  fake.touch()
  await frames(fake, 5)
  expect(fake.y).toBe(40)
  expect(fake.pendingFrames).toBe(0)

  await go(router, '/c')
  await go(router, -1)
  await frames(fake, 4)

  expect(fake.y).toBe(40)
})

test('a new navigation ends a wait and leaves the stored offset where it was', async () => {
  const fake = fakeScroller()
  const router = mount(fake)
  fake.userScroll(300)
  await go(router, '/b')
  await go(router, -1)

  await go(router, '/c')
  expect(fake.y).toBe(0)
  expect(fake.pendingFrames).toBe(0)

  await go(router, -1)
  await frames(fake, 4)

  expect(fake.y).toBe(300)
})

test('the ceiling gives up a wait whose page is still loading, without scrolling', async () => {
  const fake = fakeScroller()
  const router = mount(fake)
  fake.userScroll(300)
  await go(router, '/b')
  startLoading()
  await go(router, -1)

  await act(async () => {
    fake.elapse(CEILING_MS)
  })

  expect(fake.y).toBe(0)
  expect(fake.pendingFrames).toBe(0)
})

test('opening Record payment over its screen does nothing on the phone', async () => {
  const fake = fakeScroller()
  const router = mount(fake, CUSTOMERS)
  fake.userScroll(500)

  await go(router, pathTo(CUSTOMER_PAYMENT, { id: 9 }), { state: { underneath: 'customers' } })
  await frames(fake, 4)

  expect(fake.scrolls).toEqual([])
  expect(fake.y).toBe(500)

  await go(router, -1)
  await frames(fake, 4)
  expect(fake.y).toBe(500)
})

test('opening Record payment over its screen keeps the offset on a computer', async () => {
  useComputer(true)
  const fake = fakeScroller()
  const router = mount(fake, CUSTOMERS)
  fake.userScroll(500)

  await go(router, pathTo(CUSTOMER_PAYMENT, { id: 9 }), { state: { underneath: 'customers' } })
  expect(fake.scrolls).toEqual([])
  fake.userScroll(0)
  await frames(fake, SETTLE_FRAMES + 1)

  expect(fake.scrolls).toEqual([500])
  expect(fake.y).toBe(500)
})

test('on a computer a move between the two panes does nothing', async () => {
  useComputer(true)
  const fake = fakeScroller()
  const router = mount(fake, CUSTOMERS)
  fake.userScroll(500)

  await go(router, pathTo(CUSTOMER, { id: 3 }))
  await go(router, pathTo(CUSTOMER, { id: 5 }))
  await frames(fake, 4)

  expect(fake.scrolls).toEqual([])
  expect(fake.y).toBe(500)
})

test('on the phone the same list row is a new screen from its top', async () => {
  const fake = fakeScroller()
  const router = mount(fake, CUSTOMERS)
  fake.userScroll(500)

  await go(router, pathTo(CUSTOMER, { id: 3 }))

  expect(fake.y).toBe(0)
})

test('only the last offsets are kept: the oldest entry is forgotten', async () => {
  const fake = fakeScroller()
  const router = mount(fake)
  fake.userScroll(777)
  for (let index = 0; index < MAX_REMEMBERED + 5; index += 1) {
    await go(router, `/page-${index}`)
    fake.userScroll(10)
  }

  await go(router, -(MAX_REMEMBERED + 5))
  await frames(fake, 4)

  expect(fake.y).toBe(0)
})

test('nothing of the offsets reaches browser storage or history state', async () => {
  const fake = fakeScroller()
  const router = mount(fake)
  fake.userScroll(300)

  await go(router, '/b')

  expect(window.localStorage.length).toBe(0)
  expect(window.sessionStorage.length).toBe(0)
  expect(router.state.location.state).toBeNull()
})
