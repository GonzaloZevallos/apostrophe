/**
 * `SettingsAvatar` at the component seam, through the real router (CODING_STANDARDS §10): the
 * phone header of the six screens that carry it holds exactly one link named "Settings", one
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

    await userEvent.click(links[0] as HTMLElement)

    expect(router.state.location.pathname).toBe(SETTINGS)
  })
})

describe('on the computer', () => {
  test.each(PATHS)('%s draws no Settings avatar: the side rail has the Business row', async (_name, path) => {
    await openAt(path, 'computer')

    expect(screen.queryByRole('link', { name: 'Settings' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Settings for La Huerta' })).toBeInTheDocument()
  })
})
