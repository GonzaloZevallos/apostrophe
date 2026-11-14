/**
 * The Home | Analysis segment through the real route table on the phone (navigation.md, GH-480):
 * `router.tsx`'s own router, `<App />`, the real `Root` with its `ScrollSync` on the window, the
 * real `Shell` (bar and rail) and the real Home and Analysis screens, with the API faked at
 * `fetch`. Every switch is a REPLACE: the history position does not move, the page opens at the
 * top, the tapped option is marked and the bar keeps Home marked. The bar's Home tab, a
 * deliberate move, is a PUSH. Tapping the option already marked changes nothing: no entry, no
 * scroll, the Panel tab and the month stay.
 */

import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import analysisFixture from '../api/fixtures/analysis.json'
import panelFixture from '../api/fixtures/panel.json'
import App from '../App'
import { queryClient } from '../queryClient'
import { router } from '../router'
import { ANALYSIS, HOME, SALES, type Viewport } from '../routes'
import { SHOWN_EN } from '../test/shownLanguage'
import { stubViewport } from '../test-viewport'

const ME = { email: 'ana@x.com', business_name: 'La Huerta', today: '2026-10-04', shown_language: SHOWN_EN, money: { symbol: '$', decimals: 0 } }

const fetched: string[] = []

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

/** The window's scroll offset, held by the test: `ScrollSync` writes it through `window.scrollTo`. */
const page = {
  y: 0,
  scrollTo(y: number) {
    page.y = y
    window.dispatchEvent(new Event('scroll'))
  },
}

let stopCounting: () => void = () => undefined
/** react-router's data router does not expose the history position, so the test follows it: a
 * PUSH moves one entry on, a REPLACE stays where it is. */
const position = { index: 0, actions: [] as string[] }

beforeEach(async () => {
  page.y = 0
  Object.defineProperty(window, 'scrollY', { configurable: true, get: () => page.y })
  vi.spyOn(window, 'scrollTo').mockImplementation((options?: ScrollToOptions | number) => {
    page.scrollTo(typeof options === 'object' ? (options.top ?? 0) : 0)
  })
  fetched.length = 0
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL) => {
      const url = String(input)
      fetched.push(url)
      if (url.includes('/auth/me')) return Promise.resolve(json(ME))
      if (url.includes('/first-run')) return Promise.resolve(json({ kind: 'none' }))
      if (url.includes('/pinned-catalog/status')) return Promise.resolve(json({ status: null }))
      if (url.includes('/panel')) return Promise.resolve(json(panelFixture))
      if (url.includes('/analysis')) return Promise.resolve(json(analysisFixture))
      return Promise.resolve(json({ code: 'not_found' }, 404))
    }),
  )
})

afterEach(async () => {
  stopCounting()
  cleanup()
  await waitFor(() => expect(queryClient.isFetching()).toBe(0))
  await act(() => router.navigate(HOME))
  queryClient.clear()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

/** Opens Home with the Sales page behind it, so Back has somewhere to go. */
async function mount(viewport: Viewport = 'phone') {
  stubViewport(viewport)
  await act(() => router.navigate(SALES))
  await act(() => router.navigate(HOME))
  position.index = 0
  position.actions = []
  stopCounting = router.subscribe((state) => {
    position.actions.push(state.historyAction)
    if (state.historyAction === 'PUSH') position.index += 1
  })
  render(<App />)
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
    const { router, page, position } = await mount()
    await screen.findByRole('group', { name: 'Home view' })
    // What Home's own first render announced (its arrival, a PUSH) is not a switch.
    position.actions.length = 0
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
    const { router, position } = await mount()
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
    const { router, page, position } = await mount()
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
    const { router, page, position } = await mount()
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
  await mount('computer')

  await screen.findByRole('main')
  expect(screen.queryByRole('group', { name: 'Home view' })).not.toBeInTheDocument()
})
