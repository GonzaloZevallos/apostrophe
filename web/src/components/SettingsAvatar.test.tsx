/**
 * `SettingsAvatar` at the component seam, through the real router (CODING_STANDARDS §10): the
 * phone header of the five Tab roots that carry it holds exactly one link named "Settings", one
 * tap from `/settings`, and the computer, which has the side rail's row, holds none. API
 * faked at `fetch`: only `/auth/me` answers, the screens' own reads stay pending, because the
 * header does not wait for them.
 */

import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, test, vi } from 'vitest'
import App from '../App'
import { queryClient } from '../queryClient'
import { router } from '../router'
import { ANALYSIS, CUSTOMERS, EXPENSES, HOME, SALES, SETTINGS, VARIETIES, type Viewport } from '../routes'
import { SHOWN_EN } from '../test/shownLanguage'
import { stubViewport } from '../test-viewport'

const ME = { email: 'ana@x.com', business_name: 'La Huerta', today: '2026-10-02', shown_language: SHOWN_EN, money: { symbol: '$', decimals: 0 } }

const TAB_ROOTS = [
  ['Home', HOME],
  ['Sales', SALES],
  ['Customers', CUSTOMERS],
  ['Products', VARIETIES],
  ['Analysis', ANALYSIS],
] as const

afterEach(async () => {
  vi.unstubAllGlobals()
  queryClient.clear()
  await act(() => router.navigate(HOME))
})

const json = (body: unknown, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }))

/** What the screen's own reads answer; by default they stay pending. */
type Other = (input: RequestInfo | URL) => Promise<Response>

async function openAt(path: string, viewport: Viewport, me: typeof ME = ME, other: Other = () => new Promise<Response>(() => undefined)) {
  stubViewport(viewport)
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL) => (String(input).includes('/auth/me') ? json(me) : other(input))),
  )
  await act(() => router.navigate(path))
  render(<App />)
  return await screen.findByRole('main')
}

describe('on the phone', () => {
  test.each(TAB_ROOTS)('%s has exactly one link named Settings, and one tap reaches /settings', async (_name, path) => {
    await openAt(path, 'phone')

    const links = screen.getAllByRole('link', { name: 'Settings' })
    expect(links).toHaveLength(1)
    expect(screen.getAllByRole('link', { name: 'Settings' })).toHaveLength(1)
    // The glyph is the business's initials; the name is the fixed word, never the business.
    expect(links[0]).toHaveTextContent('LH')
    expect(links[0]).toHaveAttribute('href', SETTINGS)
    // The drawn disc is a child of the link's 44 px box and holds the initials.
    const disc = links[0]?.firstElementChild
    expect(disc).toHaveClass('inicio__avatar-disc')
    expect(disc).toHaveTextContent('LH')

    await userEvent.click(links[0] as HTMLElement)

    expect(router.state.location.pathname).toBe(SETTINGS)
  })
})

describe('Expenses on the phone', () => {
  const MONTH = (categories: unknown[]) => ({ month: '2026-10', total: 0, categories })
  const WITH_ONE = MONTH([
    { id: 1, name: 'Rent', subtotal: 500, expenses: [{ id: 7, spent_on: '2026-10-01', category_id: 1, amount: 500, detail: '' }] },
  ])

  test.each([
    ['loading', undefined],
    ['an empty month', () => json(MONTH([]))],
    ['a server error', () => json({ detail: 'boom' }, 500)],
    ['a connection that fails', () => Promise.reject(new TypeError('Failed to fetch'))],
    ['one expense', () => json(WITH_ONE)],
  ] as const)('while %s the header has no Settings avatar, only the way back and the add action', async (_state, other) => {
    await openAt(EXPENSES, 'phone', ME, other)
    // Let the month read settle into its state before looking.
    await act(async () => {
      await Promise.resolve()
    })

    expect(screen.queryByRole('link', { name: /^(Settings|Ajustes y cuenta)$/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^(Settings|Ajustes y cuenta)$/ })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Add expense' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '‹ Analysis' })).toBeInTheDocument()
  })
})

describe('while the Business has no name to take initials from', () => {
  test.each([
    ['Home', HOME],
    ['Analysis', ANALYSIS],
  ] as const)('%s still has one link named Settings, with an empty disc: no letters, no placeholder', async (_name, path) => {
    await openAt(path, 'phone', { ...ME, business_name: '' })

    const links = screen.getAllByRole('link', { name: 'Settings' })
    expect(links).toHaveLength(1)
    expect(links[0]).toHaveAttribute('href', SETTINGS)
    expect(links[0]?.firstElementChild).toHaveClass('inicio__avatar-disc')
    expect(links[0]).toHaveTextContent(/^$/)
    await userEvent.click(links[0] as HTMLElement)
    expect(router.state.location.pathname).toBe(SETTINGS)
  })
})

describe('on the computer', () => {
  test.each([...TAB_ROOTS, ['Expenses', EXPENSES]] as const)('%s draws no Settings avatar: the side rail has the Business row', async (_name, path) => {
    await openAt(path, 'computer')

    expect(screen.queryByRole('link', { name: 'Settings' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Settings for La Huerta' })).toBeInTheDocument()
  })
})
