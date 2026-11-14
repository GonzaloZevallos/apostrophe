/**
 * Home's entry point to Analysis, through the real router (CODING_STANDARDS §10): on the phone
 * the Home | Analysis segment sits under the header with Home selected and "Analysis" opens
 * `/analysis`; on the computer, which reaches Analysis from the side rail, the segment is absent.
 */

import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, test, vi } from 'vitest'
import App from '../App'
import { queryClient } from '../queryClient'
import { router } from '../router'
import { ANALYSIS, HOME, type Viewport } from '../routes'
import { SHOWN_EN } from '../test/shownLanguage'
import { stubViewport } from '../test-viewport'

const ME = { email: 'ana@x.com', business_name: 'La Huerta', today: '2026-10-02', shown_language: SHOWN_EN, money: { symbol: '$', decimals: 0 } }

afterEach(async () => {
  vi.unstubAllGlobals()
  queryClient.clear()
  await act(() => router.navigate(HOME))
})

async function openHome(viewport: Viewport) {
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
  await act(() => router.navigate(HOME))
  render(<App />)
  return await screen.findByRole('main')
}

describe('Home', () => {
  test('on the phone Home is selected and Analysis opens /analysis', async () => {
    const main = await openHome('phone')

    const group = within(main).getByRole('group', { name: 'Home view' })
    expect(within(group).getByRole('link', { name: 'Home' })).toHaveAttribute('aria-current', 'page')

    await userEvent.click(within(group).getByRole('link', { name: 'Analysis' }))

    expect(router.state.location.pathname).toBe(ANALYSIS)
  })

  test('on the computer there is no segment', async () => {
    const main = await openHome('computer')

    expect(within(main).queryByRole('group', { name: 'Home view' })).not.toBeInTheDocument()
  })
})
