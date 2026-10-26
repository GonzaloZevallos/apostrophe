/**
 * The stock entry form (new, edit) as a sheet, at the tree seam: the app's real route table with
 * `fetch` faked. On a phone a direct address shows the form as a sheet over its parent (new over
 * the Varieties list, edit over All entries), the parent drawn as an inert, hidden `BehindPane`;
 * focus is in the first field, the sheet shows exactly one Close, and everything that sat below the
 * main action (the delete) sits above it inside the pinned actions. On a computer the form is the
 * page it always was, with nothing behind it (ADR-0053).
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RouterProvider, createMemoryRouter } from 'react-router'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { router as appRouter } from '../router'
import { STOCK_ENTRY, STOCK_ENTRY_NEW, pathTo } from '../routes'
import type { Viewport } from '../routes'
import { COMMON_TEXT } from '../copy/common'
import { STOCK_TEXT } from '../copy/stock'
import { behindPane, expectBehindPane, expectBehindPaneEmpty } from '../test/behindPane'
import { flipViewport, renderWithViewport } from '../test-viewport'

const ME = { email: 'a@b.com', business_name: 'Business', today: '2026-10-03' }
const VARIETIES = [
  { id: 3, name: '24K Gold', archived: false, current_price: null },
  { id: 4, name: 'Sir Jack', archived: false, current_price: null },
]
const ENTRY = {
  id: 12,
  date: '2026-10-02',
  variety_id: 3,
  origin: 'purchase',
  grams: 30,
  total_cost: 150000,
  cost_per_gram: 5000,
  note: null,
}
const STOCK = {
  total: 30,
  varieties: [
    {
      variety_id: 3,
      grams: 30,
      status: 'ok',
      sold_out_since: null,
      threshold: null,
      days_left: 40,
    },
    {
      variety_id: 4,
      grams: 0,
      status: 'no_entries',
      sold_out_since: null,
      threshold: null,
      days_left: null,
    },
  ],
  entries: [ENTRY],
}
const EDIT = pathTo(STOCK_ENTRY, { id: 12 })

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

type Answers = Record<string, () => Response | Promise<Response>>

function renderApp(entries: { pathname: string }[], viewport: Viewport, answers: Answers = {}) {
  const table: Answers = {
    'GET /auth/me': () => jsonResponse(200, ME),
    'GET /varieties': () => jsonResponse(200, VARIETIES),
    'GET /stock': () => jsonResponse(200, STOCK),
    'GET /stock/entries/12': () => jsonResponse(200, ENTRY),
    'GET /catalog': () => jsonResponse(200, { varieties: [] }),
    'GET /first-run': () =>
      jsonResponse(200, {
        kind: 'none',
        checklist: [],
        import_notice: false,
        nothing_qualifies: false,
      }),
    'GET /pinned-catalog/status': () => jsonResponse(200, { status: null }),
    'GET /onboarding-progress': () => jsonResponse(200, { offered: false }),
    ...answers,
  }
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init?: RequestInit) => {
      const answer = table[`${init?.method ?? 'GET'} ${url}`]
      return Promise.resolve(answer === undefined ? jsonResponse(404, {}) : answer())
    }),
  )
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  const router = createMemoryRouter(appRouter.routes, {
    initialEntries: entries,
    initialIndex: entries.length - 1,
  })
  renderWithViewport(viewport, () =>
    render(
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    ),
  )
  return router
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('on a phone, a direct address', () => {
  test('new entry: the sheet over the Varieties list, focus in the first field, one Close', async () => {
    renderApp([{ pathname: STOCK_ENTRY_NEW }], 'phone')

    const dialog = await screen.findByRole('dialog', {
      name: STOCK_TEXT.nuevaEntrada,
    })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    await waitFor(() => expect(screen.getByLabelText(COMMON_TEXT.date)).toHaveFocus())
    expect(screen.getAllByRole('button', { name: COMMON_TEXT.close })).toHaveLength(1)
    expect(within(dialog).getByRole('button', { name: COMMON_TEXT.close })).toBeInTheDocument()

    const pane = behindPane()
    expectBehindPane(pane)
    await waitFor(() => expect(pane).toHaveTextContent('24K Gold'))
    expect(pane).toHaveTextContent('Sir Jack')
    expect(pane).not.toContainElement(dialog)
    const actions = document.querySelector('.sheet__actions')
    expect(actions).toContainElement(screen.getByRole('button', { name: STOCK_TEXT.guardaLaEntrada }))
    // The form's own element is the actions' parent: nothing renders below the main action.
    expect(actions?.parentElement?.tagName).toBe('FORM')
    expect(actions?.nextElementSibling).toBeNull()
  })

  test('edit entry: the sheet over All entries, focus in the first field, Delete above Save', async () => {
    renderApp([{ pathname: EDIT }], 'phone')

    const dialog = await screen.findByRole('dialog', {
      name: STOCK_TEXT.editarEntrada,
    })
    await waitFor(() => expect(within(dialog).getByLabelText(COMMON_TEXT.date)).toHaveFocus())
    expect(screen.getAllByRole('button', { name: COMMON_TEXT.close })).toHaveLength(1)

    const pane = behindPane()
    expectBehindPane(pane)
    await waitFor(() => expect(pane).toHaveTextContent('24K Gold'))
    expect(pane).toHaveTextContent('30 g')
    expect(pane).not.toContainElement(dialog)

    const actions = document.querySelector('.sheet__actions')
    const names = Array.from(actions?.querySelectorAll('button') ?? []).map(
      (button) => button.getAttribute('aria-label') ?? button.textContent,
    )
    expect(names).toEqual([STOCK_TEXT.borrarEntrada, COMMON_TEXT.save])
    expect(actions?.nextElementSibling).toBeNull()
  })

  test('the panes are empty while their data is pending, and after an error', async () => {
    const pending = (): Promise<Response> => new Promise<Response>(() => undefined)
    renderApp([{ pathname: STOCK_ENTRY_NEW }], 'phone', {
      'GET /varieties': pending,
    })
    await screen.findByRole('dialog', { name: STOCK_TEXT.nuevaEntrada })
    expectBehindPaneEmpty(behindPane())
  })

  test('a server error on All entries leaves its pane empty, with no wording of its own', async () => {
    renderApp([{ pathname: EDIT }], 'phone', {
      'GET /stock': () => jsonResponse(500, {}),
    })

    // The form needs the stock only for the new-entry preselection, so the sheet still shows.
    await screen.findByRole('dialog', { name: STOCK_TEXT.editarEntrada })
    await new Promise((resolve) => setTimeout(resolve, 30))
    expectBehindPaneEmpty(behindPane())
  })

  test('a flip across 900 px keeps what was typed in the form', async () => {
    renderApp([{ pathname: STOCK_ENTRY_NEW }], 'phone')

    const grams = await screen.findByLabelText(COMMON_TEXT.grams)
    await userEvent.type(grams, '25')
    flipViewport('computer')
    expect(screen.getByLabelText(COMMON_TEXT.grams)).toBe(grams)
    expect(grams).toHaveValue('25')
    flipViewport('phone')
    expect(screen.getByLabelText(COMMON_TEXT.grams)).toBe(grams)
    expect(grams).toHaveValue('25')
  })
})

describe('on a computer', () => {
  test('the form is the page it always was: no pane, no sheet', async () => {
    renderApp([{ pathname: STOCK_ENTRY_NEW }], 'computer')

    await screen.findByLabelText(COMMON_TEXT.grams)
    expect(document.querySelector('.behind-pane')).toBeNull()
    expect(document.querySelector('.sheet')).toBeNull()
    expect(document.querySelector('.sheet__actions')).toBeNull()
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
