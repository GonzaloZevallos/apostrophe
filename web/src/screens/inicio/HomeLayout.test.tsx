/**
 * `HomeLayout`, the one header of Home and Analysis, through the real route table (`router.tsx`,
 * `<App />`, the real `Shell`) at `/`, `/analysis` and `/expenses`, with the API faked at `fetch`.
 * The header is a plain div outside every content area: it shows with the view loading and in
 * error, it holds the date line, an empty inert slot, the avatar and the segment on the phone,
 * and exactly one h1 (hidden on the phone). The scroll and history rules of the segment itself
 * are `HomeViewSwitch.router.test.tsx`'s.
 */

import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, test, vi } from 'vitest'
import analysisFixture from '../../api/fixtures/analysis.json'
import panelFixture from '../../api/fixtures/panel.json'
import App from '../../App'
import { queryClient } from '../../queryClient'
import { router } from '../../router'
import { ANALYSIS, EXPENSES, HOME, type Viewport } from '../../routes'
import { SHOWN_EN } from '../../test/shownLanguage'
import { stubViewport } from '../../test-viewport'

const ME = { email: 'ana@x.com', business_name: 'La Huerta', today: '2026-10-03', shown_language: SHOWN_EN, money: { symbol: '$', decimals: 0 } }

type Answers = 'held' | 'answered' | 'failed'

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

async function open(path: string, viewport: Viewport, answers: Answers = 'answered') {
  stubViewport(viewport)
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/auth/me')) return Promise.resolve(json(ME))
      if (answers === 'held') return new Promise<Response>(() => undefined)
      if (answers === 'failed') return Promise.resolve(json({ code: 'boom' }, 500))
      if (url.includes('/pinned-catalog/status')) return Promise.resolve(json({ status: null }))
      if (url.includes('/panel')) return Promise.resolve(json(panelFixture))
      if (url.includes('/analysis')) return Promise.resolve(json(analysisFixture))
      if (url.includes('/expense-categories')) return Promise.resolve(json([]))
      if (url.includes('/expenses')) return Promise.resolve(json({ month: '2026-10', total: 0, categories: [] }))
      return Promise.resolve(json([]))
    }),
  )
  await act(() => router.navigate(path))
  render(<App />)
  await screen.findByRole('main')
  return screen.queryByRole('heading', { level: 1 }) as HTMLElement
}

/** The header div: the h1's parent is the only box the layout puts it in. */
function headerOf(title: HTMLElement): HTMLElement {
  return title.parentElement as HTMLElement
}

afterEach(async () => {
  cleanup()
  vi.unstubAllGlobals()
  queryClient.clear()
  await act(() => router.navigate(HOME))
})

describe.each([
  { path: HOME, title: 'Home' },
  { path: ANALYSIS, title: 'Analysis' },
])('$title header', ({ path, title }) => {
  test.each(['held', 'failed', 'answered'] as const)('on the phone it has one hidden h1 (%s)', async (answers) => {
    const h1 = await open(path, 'phone', answers)

    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    expect(h1).toHaveTextContent(title)
    expect(h1).toHaveClass('visualmente-oculto')
  })

  test.each(['held', 'failed', 'answered'] as const)('on the computer it has one visible h1 (%s)', async (answers) => {
    const h1 = await open(path, 'computer', answers)

    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    expect(h1).toHaveTextContent(title)
    expect(h1).not.toHaveClass('visualmente-oculto')
  })

  test('on the phone it reads the date line, the empty slot, the avatar, the segment and the h1, in that order', async () => {
    const h1 = await open(path, 'phone')
    const header = headerOf(h1)

    const date = within(header).getByText('03/10')
    const slot = date.nextElementSibling as HTMLElement
    expect(slot).toBeEmptyDOMElement()
    expect(slot).not.toHaveAttribute('role')
    expect(slot).not.toHaveAttribute('tabindex')
    const avatar = within(header).getByRole('link', { name: 'Settings' })
    const group = within(header).getByRole('group', { name: 'Home view' })
    const follows = (a: Node, b: Node) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)
    expect(follows(date, slot) && follows(slot, avatar) && follows(avatar, group) && follows(group, h1)).toBe(true)
    // Not a banner: the chrome's own header is the only <header>.
    expect(header.tagName).toBe('DIV')
    expect(within(header).queryByText('La Huerta')).not.toBeInTheDocument()
    expect(within(header).queryByAltText('apostrophe')).not.toBeInTheDocument()
  })

  test('on the phone its only interactive elements are the two segments and the avatar', async () => {
    const h1 = await open(path, 'phone')

    const interactive = headerOf(h1).querySelectorAll('a, button, input, select, textarea, summary, [tabindex], [role="button"]')
    expect([...interactive].map((element) => element.getAttribute('aria-label') ?? element.textContent)).toEqual([
      'Settings',
      'Today',
      'Analysis',
    ])
  })

  test('while the view loads the header works, sits outside the content area, and no digit is inside it', async () => {
    const h1 = await open(path, 'phone', 'held')
    const header = headerOf(h1)

    const main = screen.getByRole('main')
    expect(main).toHaveAttribute('data-content-area')
    await waitFor(() => expect(main).toHaveAttribute('aria-busy', 'true'))
    expect(main).not.toContainElement(header)
    expect(main.textContent).not.toMatch(/[0-9]/)
    expect(within(header).getByText('03/10')).toBeInTheDocument()
    expect(within(header).getByRole('link', { name: 'Settings' })).toBeEnabled()
    const other = path === HOME ? 'Analysis' : 'Today'
    // react-router's data router does not expose the history position, so follow it: a PUSH moves
    // one entry on, a REPLACE stays where it is.
    const position = { index: 0, actions: [] as string[] }
    const stop = router.subscribe((state) => {
      position.actions.push(state.historyAction)
      if (state.historyAction === 'PUSH') position.index += 1
    })
    await userEvent.click(within(header).getByRole('link', { name: other }))
    stop()
    expect(router.state.historyAction).toBe('REPLACE')
    expect(position.index).toBe(0)
    expect(position.actions.length).toBeGreaterThan(0)
    expect(position.actions.every((action) => action === 'REPLACE')).toBe(true)
    expect(router.state.location.pathname).toBe(path === HOME ? ANALYSIS : HOME)
  })

  test('with the view in error the header, the segment and the avatar are still there', async () => {
    const h1 = await open(path, 'phone', 'failed')

    const header = headerOf(h1)
    expect(within(header).getByRole('link', { name: 'Settings' })).toBeInTheDocument()
    expect(within(header).getByRole('group', { name: 'Home view' })).toBeInTheDocument()
    expect(within(header).getByText('03/10')).toBeInTheDocument()
  })
})

describe('on the computer', () => {
  test('Home shows the business name above the visible title, and nothing else', async () => {
    const h1 = await open(HOME, 'computer')
    const header = headerOf(h1)

    const name = within(header).getByText('La Huerta')
    expect(name.compareDocumentPosition(h1) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect([...header.children]).toEqual([name, h1])
    expect(header.querySelector('a, button')).toBeNull()
  })

  test('Analysis shows only the title', async () => {
    const h1 = await open(ANALYSIS, 'computer')

    expect([...headerOf(h1).children]).toEqual([h1])
  })
})

describe('Expenses', () => {
  test.each(['phone', 'computer'] as const)('is never wrapped: no segment, no date line, no layout title (%s)', async (viewport) => {
    // Expenses' own title is a span, as before this layout: the layout adds no h1 to it.
    const h1 = await open(EXPENSES, viewport)

    expect(h1).toBeNull()
    expect(screen.queryByRole('group', { name: 'Home view' })).not.toBeInTheDocument()
    expect(screen.queryByText('03/10')).not.toBeInTheDocument()
  })
})
