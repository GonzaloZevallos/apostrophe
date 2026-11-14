/**
 * `SettingsAvatar` at the component seam, through the real router (CODING_STANDARDS §10): the
 * phone header of the six screens that carry it holds exactly one link named "Settings", one
 * tap from `/settings`, and the computer, which has the side rail's row, holds none. API
 * faked at `fetch`: only `/auth/me` answers, the screens' own reads stay pending, because the
 * header does not wait for them.
 */

import { act, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, test, vi } from 'vitest'
import App from '../App'
import { queryClient } from '../queryClient'
import { router } from '../router'
import { ANALYSIS, CUSTOMERS, EXPENSES, HOME, SALES, SETTINGS, VARIETIES, type Viewport } from '../routes'
import SettingsAvatar from './SettingsAvatar'
import { SHOWN_EN } from '../test/shownLanguage'
import { stubViewport } from '../test-viewport'

const ME = { email: 'ana@x.com', business_name: 'La Huerta', today: '2026-10-02', shown_language: SHOWN_EN, money: { symbol: '$', decimals: 0 } }

const PATHS = [
  ['Home', HOME],
  ['Sales', SALES],
  ['Customers', CUSTOMERS],
  ['Products', VARIETIES],
  ['Analysis', ANALYSIS],
  ['Expenses', EXPENSES],
] as const

afterEach(async () => {
  vi.unstubAllGlobals()
  queryClient.clear()
  await act(() => router.navigate(HOME))
})

async function openAt(path: string, viewport: Viewport) {
  stubViewport(viewport)
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL) =>
      String(input).includes('/auth/me')
        ? Promise.resolve(
            new Response(JSON.stringify(ME), { status: 200, headers: { 'Content-Type': 'application/json' } }),
          )
        : new Promise<Response>(() => undefined),
    ),
  )
  await act(() => router.navigate(path))
  render(<App />)
  return await screen.findByRole('main')
}

describe('on the phone', () => {
  test.each(PATHS)('%s has exactly one link named Settings, and one tap reaches /settings', async (_name, path) => {
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

describe('while the business name is not known', () => {
  test('the link is still there, named Settings, with an empty disc: no letters, no placeholder', () => {
    stubViewport('phone')
    render(
      <MemoryRouter>
        <SettingsAvatar />
      </MemoryRouter>,
    )

    const links = screen.getAllByRole('link', { name: 'Settings' })
    expect(links).toHaveLength(1)
    expect(links[0]).toHaveAttribute('href', SETTINGS)
    expect(links[0]?.firstElementChild).toHaveClass('inicio__avatar-disc')
    expect(links[0]).toHaveTextContent(/^$/)
  })
})

describe('on the computer', () => {
  test.each(PATHS)('%s draws no Settings avatar: the side rail has the Business row', async (_name, path) => {
    await openAt(path, 'computer')

    expect(screen.queryByRole('link', { name: 'Settings' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Settings for La Huerta' })).toBeInTheDocument()
  })
})
