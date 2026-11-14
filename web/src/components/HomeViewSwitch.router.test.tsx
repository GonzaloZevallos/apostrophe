/**
 * The Home | Analysis segment through a real router on the phone (navigation.md, GH-480): the
 * real `Shell` (bar and rail), the real `ScrollSync` with a scroller the test holds, and the
 * registry-bound routes of Home and Analysis (`screenRoute`). Every switch is a REPLACE: the
 * history position does not move, the page opens at the top, the tapped option is marked and the
 * bar keeps Home marked. The bar's Home tab, a deliberate move, is a PUSH. Tapping the option
 * already marked changes nothing: no entry, no scroll, the Panel tab and the month stay.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, Outlet, RouterProvider } from 'react-router'
import { afterEach, describe, expect, test, vi } from 'vitest'
import type { Me } from '../api/me'
import analysisFixture from '../api/fixtures/analysis.json'
import panelFixture from '../api/fixtures/panel.json'
import { MoneyFormatProvider } from '../format/MoneyFormatProvider'
import { ANALYSIS, HOME, SALES, type Viewport } from '../routes'
import Analisis from '../screens/Analisis'
import Inicio from '../screens/Inicio'
import ScrollSync from '../shell/ScrollSync'
import Shell from '../shell/Shell'
import type { Scroller } from '../shell/scroller'
import { screenRoute } from '../test/screenRoute'
import { SHOWN_EN } from '../test/shownLanguage'
import { stubViewport } from '../test-viewport'

const ME: Me = { email: 'ana@x.com', business_name: 'La Huerta', today: '2026-10-04', shown_language: SHOWN_EN, money: { symbol: '$', decimals: 0 } }

const fetched: string[] = []

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })
}

/** A page whose scroll offset the test sets and reads; `setY` is what `ScrollSync` calls. */
function heldScroller() {
  const state = { y: 0 }
  const listeners = new Set<() => void>()
  const scroller: Scroller = {
    y: () => state.y,
    maxY: () => 2000,
    height: () => 2800,
    setY: (top) => {
      state.y = top
      listeners.forEach((listener) => listener())
    },
    onScroll: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    onInput: () => () => undefined,
    frame: (callback) => {
      const id = window.setTimeout(callback, 0)
      return () => window.clearTimeout(id)
    },
    after: (ms, callback) => {
      const id = window.setTimeout(callback, ms)
      return () => window.clearTimeout(id)
    },
  }
  return {
    scroller,
    get y() {
      return state.y
    },
    scrollTo(y: number) {
      state.y = y
      listeners.forEach((listener) => listener())
    },
  }
}

function mount(viewport: Viewport = 'phone') {
  stubViewport(viewport)
  fetched.length = 0
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL) => {
      const url = String(input)
      fetched.push(url)
      if (url.includes('/first-run')) return Promise.resolve(json({ kind: 'none' }))
      if (url.includes('/pinned-catalog/status')) return Promise.resolve(json({ status: null }))
      if (url.includes('/panel')) return Promise.resolve(json(panelFixture))
      if (url.includes('/analysis')) return Promise.resolve(json(analysisFixture))
      return Promise.reject(new Error(`unexpected fetch: ${url}`))
    }),
  )
  const page = heldScroller()
  const router = createMemoryRouter(
    [
      {
        element: (
          <>
            <ScrollSync scroller={page.scroller} />
            <MoneyFormatProvider format={ME.money}>
              <Outlet context={ME} />
            </MoneyFormatProvider>
          </>
        ),
        children: [
          { path: SALES, element: <span>previous screen</span> },
          {
            element: <Shell />,
            children: [screenRoute('home', <Inicio />), screenRoute('analysis', <Analisis />)],
          },
        ],
      },
    ],
    { initialEntries: [SALES, HOME], initialIndex: 1 },
  )
  // react-router's data router does not expose the history position, so the test follows it:
  // a PUSH moves one entry on, a REPLACE stays where it is.
  const position = { index: 1, actions: [] as string[] }
  router.subscribe((state) => {
    position.actions.push(state.historyAction)
    if (state.historyAction === 'PUSH') position.index += 1
  })
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
  return { router, page, position }
}

/** The bottom bar's Home tab: the rail is the other navigation, the bar comes last. */
function barHome(): HTMLElement {
  const bar = screen.getAllByRole('navigation').at(-1) as HTMLElement
  return within(bar).getByRole('link', { name: 'Home' })
}

function segment(name: 'Today' | 'Analysis'): HTMLElement {
  return within(screen.getByRole('group', { name: 'Home view' })).getByRole('link', { name })
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('switching on the phone', () => {
  test('three round trips are all REPLACE at one history position, at the top, with the bar on Home', async () => {
    const { router, page, position } = mount()
    await screen.findByRole('group', { name: 'Home view' })
    const index = position.index

    for (let round = 0; round < 3; round += 1) {
      act(() => page.scrollTo(300))

      await userEvent.click(segment('Analysis'))
      await waitFor(() => expect(segment('Analysis')).toHaveAttribute('aria-current', 'page'))
      expect(router.state.location.pathname).toBe(ANALYSIS)
      expect(router.state.historyAction).toBe('REPLACE')
      expect(position.index).toBe(index)
      expect(page.y).toBe(0)
      expect(segment('Today')).not.toHaveAttribute('aria-current')
      expect(barHome()).toHaveAttribute('aria-current', 'page')

      act(() => page.scrollTo(300))

      await userEvent.click(segment('Today'))
      await waitFor(() => expect(segment('Today')).toHaveAttribute('aria-current', 'page'))
      expect(router.state.location.pathname).toBe(HOME)
      expect(router.state.historyAction).toBe('REPLACE')
      expect(position.index).toBe(index)
      expect(page.y).toBe(0)
      expect(barHome()).toHaveAttribute('aria-current', 'page')
    }

    expect(position.actions.every((action) => action === 'REPLACE')).toBe(true)
    // Back leaves the pair for the screen the owner came from, not for the other view.
    await act(() => router.navigate(-1))
    expect(router.state.location.pathname).toBe(SALES)
  })

  test("the bar's Home tab is a PUSH", async () => {
    const { router, position } = mount()
    await screen.findByRole('group', { name: 'Home view' })
    await userEvent.click(segment('Analysis'))
    await waitFor(() => expect(segment('Analysis')).toHaveAttribute('aria-current', 'page'))
    const index = position.index

    await userEvent.click(barHome())

    await waitFor(() => expect(router.state.location.pathname).toBe(HOME))
    expect(router.state.historyAction).toBe('PUSH')
    expect(position.index).toBe(index + 1)
  })
})

describe('tapping the option already marked', () => {
  test('on Home it changes no entry, no scroll and not the Panel tab', async () => {
    const { router, page, position } = mount()
    await userEvent.click(await screen.findByRole('button', { name: 'Week' }))
    expect(screen.getByRole('button', { name: 'Week' })).toHaveAttribute('aria-pressed', 'true')
    act(() => page.scrollTo(420))
    const index = position.index

    await userEvent.click(segment('Today'))

    expect(router.state.location.pathname).toBe(HOME)
    expect(position.index).toBe(index)
    expect(page.y).toBe(420)
    expect(screen.getByRole('button', { name: 'Week' })).toHaveAttribute('aria-pressed', 'true')
    expect(segment('Today')).toHaveAttribute('aria-current', 'page')
  })

  test('on Analysis it changes no entry, no scroll and not the month', async () => {
    const { router, page, position } = mount()
    await screen.findByRole('group', { name: 'Home view' })
    await userEvent.click(segment('Analysis'))
    await userEvent.click(await screen.findByRole('button', { name: 'Previous month' }))
    await waitFor(() => expect(fetched.filter((url) => url.includes('/analysis'))).toHaveLength(2))
    const monthNav = (): string | null => screen.getByRole('button', { name: 'Previous month' }).parentElement?.textContent ?? null
    const month = monthNav()
    const asked = fetched.length
    act(() => page.scrollTo(420))
    const index = position.index

    await userEvent.click(segment('Analysis'))

    expect(router.state.location.pathname).toBe(ANALYSIS)
    expect(position.index).toBe(index)
    expect(page.y).toBe(420)
    expect(fetched).toHaveLength(asked)
    expect(monthNav()).toBe(month)
    expect(segment('Analysis')).toHaveAttribute('aria-current', 'page')
  })
})

test('on the computer the control renders nothing', async () => {
  mount('computer')

  await screen.findByRole('main')
  expect(screen.queryByRole('group', { name: 'Home view' })).not.toBeInTheDocument()
})
