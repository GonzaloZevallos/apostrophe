/**
 * Analysis' entry points, through the real router (CODING_STANDARDS §10): the Home | Analysis
 * segment with Analysis selected ("Home" leads to Home), and the Expenses card with "Add
 * expense" (the Expense form, whose "Close" goes back to where it was opened) and "See the
 * expenses". The computer reaches Expenses from the side rail, so there the card and the
 * segment are absent.
 */

import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, test, vi } from 'vitest'
import App from '../App'
import { queryClient } from '../queryClient'
import { router } from '../router'
import { ANALYSIS, EXPENSE_NEW, EXPENSES, HOME, type Viewport } from '../routes'
import { SHOWN_EN } from '../test/shownLanguage'
import { stubViewport } from '../test-viewport'

const ME = { email: 'ana@x.com', business_name: 'La Huerta', today: '2026-10-02', shown_language: SHOWN_EN, money: { symbol: '$', decimals: 0 } }

function json(body: unknown): Promise<Response> {
  return Promise.resolve(
    new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } }),
  )
}

afterEach(async () => {
  vi.unstubAllGlobals()
  queryClient.clear()
  await act(() => router.navigate(HOME))
})

async function openAt(path: string, viewport: Viewport) {
  stubViewport(viewport)
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/auth/me')) return json(ME)
      if (url.includes('/expense-categories')) return json([])
      if (url.includes('/expenses')) return json({ month: '2026-10', total: 0, categories: [] })
      return new Promise<Response>(() => undefined)
    }),
  )
  await act(() => router.navigate(path))
  render(<App />)
  return await screen.findByRole('main')
}

describe('Analysis on the phone', () => {
  test('the segment has Analysis selected and Home leads back to Home', async () => {
    await openAt(ANALYSIS, 'phone')

    const group = screen.getByRole('group', { name: 'Home view' })
    expect(within(group).getByRole('link', { name: 'Analysis' })).toHaveAttribute('aria-current', 'page')

    await userEvent.click(within(group).getByRole('link', { name: 'Home' }))

    expect(router.state.location.pathname).toBe(HOME)
  })

  test('the Expenses card: "See the expenses" opens Expenses', async () => {
    const main = await openAt(ANALYSIS, 'phone')

    const card = within(main).getByRole('group', { name: 'Expenses' })
    await userEvent.click(within(card).getByRole('link', { name: 'See the expenses' }))

    expect(router.state.location.pathname).toBe(EXPENSES)
  })

  test('the Expenses card: "Add expense" opens the form, and Close goes back to Analysis', async () => {
    const main = await openAt(ANALYSIS, 'phone')

    const card = within(main).getByRole('group', { name: 'Expenses' })
    await userEvent.click(within(card).getByRole('link', { name: 'Add expense' }))

    expect(router.state.location.pathname).toBe(EXPENSE_NEW)
    await userEvent.click(await screen.findByRole('button', { name: 'Close' }))
    await waitFor(() => expect(router.state.location.pathname).toBe(ANALYSIS))
  })

  test('the Expense form opened with no history closes to Expenses', async () => {
    await openAt(EXPENSE_NEW, 'phone')

    await userEvent.click(await screen.findByRole('button', { name: 'Close' }))

    await waitFor(() => expect(router.state.location.pathname).toBe(EXPENSES))
  })
})

describe('Analysis on the computer', () => {
  test('the segment and the Expenses card are absent', async () => {
    const main = await openAt(ANALYSIS, 'computer')

    expect(screen.queryByRole('group', { name: 'Home view' })).not.toBeInTheDocument()
    expect(within(main).queryByRole('group', { name: 'Expenses' })).not.toBeInTheDocument()
  })
})
