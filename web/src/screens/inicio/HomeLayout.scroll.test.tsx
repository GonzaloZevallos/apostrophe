/**
 * Home and Analysis under `HomeLayout` with `ScrollSync`'s injected scroller (the seam
 * `ScrollSync.test.tsx` drives): scrolled mid-page, a detail opened and Back pressed (a POP),
 * each view gets the place it was left at once its data is back, and a switch from mid-scroll
 * lands at the top. The scroller is stepped by hand, so no frame or timer is waited for.
 * `ScrollSync.test.tsx` shows POP restore for bare routes only; what is new here is the layout
 * route between the root and the screens.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import { createMemoryRouter, Outlet, RouterProvider } from 'react-router'
import { afterEach, describe, expect, test, vi } from 'vitest'
import analysisFixture from '../../api/fixtures/analysis.json'
import panelFixture from '../../api/fixtures/panel.json'
import type { Me } from '../../api/me'
import { MoneyFormatProvider } from '../../format/MoneyFormatProvider'
import { ANALYSIS, CUSTOMERS, HOME } from '../../routes'
import ScrollSync from '../../shell/ScrollSync'
import type { Scroller } from '../../shell/scroller'
import { homeLayoutRoute } from '../../test/homeLayoutRoute'
import { screenRoute } from '../../test/screenRoute'
import { SHOWN_EN } from '../../test/shownLanguage'
import { stubViewport } from '../../test-viewport'
import Analisis from '../Analisis'
import Inicio from '../Inicio'

const ME: Me = { email: 'ana@x.com', business_name: 'La Huerta', today: '2026-10-03', shown_language: SHOWN_EN, money: { symbol: '$', decimals: 0 } }
const VIEWPORT_HEIGHT = 800

/** A scroller whose frames are stepped by the test and whose page is 2000 px tall. */
function fakeScroller() {
  const state = { y: 0, height: 2000 }
  const scrolls: number[] = []
  const scrollListeners = new Set<() => void>()
  let frames: (() => void)[] = []
  const maxY = () => Math.max(0, state.height - VIEWPORT_HEIGHT)
  const scroller: Scroller = {
    y: () => state.y,
    maxY,
    height: () => state.height,
    setY: (top) => {
      scrolls.push(top)
      state.y = Math.min(Math.max(0, top), maxY())
      scrollListeners.forEach((listener) => listener())
    },
    onScroll: (listener) => {
      scrollListeners.add(listener)
      return () => scrollListeners.delete(listener)
    },
    onInput: () => () => undefined,
    frame: (callback) => {
      frames.push(callback)
      return () => {
        frames = frames.filter((queued) => queued !== callback)
      }
    },
    after: () => () => undefined,
  }
  return {
    scroller,
    scrolls,
    userScroll(y: number) {
      state.y = y
      scrollListeners.forEach((listener) => listener())
    },
    runFrame() {
      const queued = frames
      frames = []
      queued.forEach((callback) => callback())
    },
    get y() {
      return state.y
    },
  }
}

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })
}

function mount(fake: ReturnType<typeof fakeScroller>, path: string) {
  stubViewport('phone')
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/pinned-catalog/status')) return Promise.resolve(json({ status: null }))
      if (url.includes('/panel')) return Promise.resolve(json(panelFixture))
      if (url.includes('/analysis')) return Promise.resolve(json(analysisFixture))
      return Promise.resolve(json([]))
    }),
  )
  const router = createMemoryRouter(
    [
      {
        element: (
          <MoneyFormatProvider format={ME.money}>
            <ScrollSync scroller={fake.scroller} />
            <Outlet context={ME} />
          </MoneyFormatProvider>
        ),
        children: [
          homeLayoutRoute([screenRoute('home', <Inicio />), screenRoute('analysis', <Analisis />)]),
          screenRoute('customers', <span>customers list</span>),
        ],
      },
    ],
    { initialEntries: [path] },
  )
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
  return router
}

async function answered() {
  await waitFor(() => expect(screen.queryByRole('progressbar')).not.toBeInTheDocument())
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe.each([
  { name: 'Home', path: HOME, other: ANALYSIS },
  { name: 'Analysis', path: ANALYSIS, other: HOME },
])('$name under HomeLayout', ({ path, other }) => {
  test('a POP from a detail restores the place it was left at', async () => {
    const fake = fakeScroller()
    const router = mount(fake, path)
    await screen.findByRole('heading', { level: 1 })
    await answered()
    act(() => fake.userScroll(300))

    await act(() => router.navigate(CUSTOMERS))
    expect(fake.y).toBe(0)
    await act(() => router.navigate(-1))
    await screen.findByRole('heading', { level: 1 })
    await answered()

    await waitFor(async () => {
      await act(async () => fake.runFrame())
      expect(fake.y).toBe(300)
    })
  })

  test('a switch from mid-scroll lands at the top', async () => {
    const fake = fakeScroller()
    const router = mount(fake, path)
    await screen.findByRole('heading', { level: 1 })
    await answered()
    act(() => fake.userScroll(300))

    await act(() => router.navigate(other, { replace: true }))

    expect(router.state.historyAction).toBe('REPLACE')
    expect(fake.y).toBe(0)
  })
})
