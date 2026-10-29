/**
 * New variety, and a variety's rename, low-stock threshold and catalog attributes, as sheets, at the
 * screen seam: the app's real route table through Testing Library with `fetch` faked. On a phone a
 * direct address to New variety shows the sheet over the Varieties list (an inert, hidden
 * `BehindPane`); the three inline edits open as in-page sheets with the variety's page itself behind
 * them, so no pane. Each sheet resolves its first focus, shows exactly one Close, and keeps its main
 * action last inside the form's pinned actions (ADR-0062). On a computer none of it is drawn.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RouterProvider, createMemoryRouter } from 'react-router'
import { act } from '@testing-library/react'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { inAppState } from '../../components/inAppState'
import { COMMON_TEXT } from '../../copy/common'
import { VARIETIES_TEXT } from '../../copy/varieties'
import { router as appRouter } from '../../router'
import { VARIETIES as VARIETIES_PATH, VARIETY, VARIETY_NEW, pathTo } from '../../routes'
import type { Viewport } from '../../routes'
import { behindPane, expectBehindPane, expectBehindPaneEmpty } from '../../test/behindPane'
import { flipViewport, renderWithViewport } from '../../test-viewport'

const ME = { email: 'a@b.com', business_name: 'Business', today: '2026-10-03' }
const VARIETIES = [
  { id: 1, name: '24K Gold', archived: false, current_price: null },
  { id: 2, name: 'Sir Jack', archived: false, current_price: null },
]
const STOCK_ROW = { variety_id: 1, quantity: 30, status: 'ok', sold_out_since: null, threshold: 20, days_left: 40 }
const STOCK = {
  total: 30,
  varieties: [STOCK_ROW, { ...STOCK_ROW, variety_id: 2, quantity: 0, status: 'no_entries', threshold: null, days_left: null }],
  entries: [],
}
const CATALOG = {
  text: 'texto',
  header: '',
  footer: '',
  varieties: [{ id: 1, name: '24K Gold', emoji: '🍪', indica_share: 70, aroma: 'Vainilla', shown: true, state: 'in' }],
}
const VARIETY_ONE = pathTo(VARIETY, { id: 1 })

/** New variety's name field: its label also holds the help line, so it is matched by its start. */
const NAME = { name: /^Name/ }

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

type Answers = Record<string, () => Response | Promise<Response>>

function renderApp(
  entry: { pathname: string; state?: unknown },
  viewport: Viewport,
  answers: Answers = {},
) {
  const table: Answers = {
    'GET /auth/me': () => jsonResponse(200, ME),
    'GET /api/products': () => jsonResponse(200, VARIETIES),
    'GET /api/products/1': () => jsonResponse(200, VARIETIES[0]),
    'GET /api/products/1/prices': () => jsonResponse(200, []),
    'GET /stock': () => jsonResponse(200, STOCK),
    'GET /stock/varieties/1/movements': () => jsonResponse(200, []),
    'GET /catalog': () => jsonResponse(200, CATALOG),
    'GET /pricing-settings': () => jsonResponse(200, { is_bulk_pricing: false, is_vip_customers: false }),
    'GET /first-run': () =>
      jsonResponse(200, { kind: 'none', checklist: [], import_notice: false, nothing_qualifies: false }),
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
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const router = createMemoryRouter(appRouter.routes, { initialEntries: [entry], initialIndex: 0 })
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

/** The names of the buttons inside the pinned actions, in order. */
function actionNames(): (string | null)[] {
  const actions = document.querySelector('.sheet__actions')
  return Array.from(actions?.querySelectorAll('button') ?? []).map(
    (button) => button.getAttribute('aria-label') ?? button.textContent,
  )
}

describe('New variety on a phone', () => {
  test('a direct address shows the sheet over Varieties, focus in the name, one Close, Save last in the form', async () => {
    renderApp({ pathname: VARIETY_NEW }, 'phone')

    const dialog = await screen.findByRole('dialog', { name: COMMON_TEXT.newVariety })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    await waitFor(() => expect(within(dialog).getByRole('textbox', NAME)).toHaveFocus())
    expect(screen.getAllByRole('button', { name: COMMON_TEXT.close })).toHaveLength(1)
    expect(within(dialog).getByRole('button', { name: COMMON_TEXT.close })).toBeInTheDocument()

    const pane = behindPane()
    expectBehindPane(pane)
    await waitFor(() => expect(pane).toHaveTextContent('24K Gold'))
    expect(pane).toHaveTextContent('Sir Jack')
    expect(pane).not.toContainElement(dialog)

    const actions = document.querySelector('.sheet__actions')
    expect(actions).toContainElement(screen.getByRole('button', { name: VARIETIES_TEXT.agregaLaVariedad }))
    expect(actions?.parentElement?.tagName).toBe('FORM')
    expect(actions?.nextElementSibling).toBeNull()
  })

  test('while Varieties is pending, and after an error, the pane is empty', async () => {
    renderApp({ pathname: VARIETY_NEW }, 'phone', {
      'GET /api/products': () => new Promise<Response>(() => undefined),
    })
    await screen.findByRole('dialog', { name: COMMON_TEXT.newVariety })
    expectBehindPaneEmpty(behindPane())
  })

  test('a server error on Varieties leaves the pane empty, with no wording of its own', async () => {
    renderApp({ pathname: VARIETY_NEW }, 'phone', { 'GET /stock': () => jsonResponse(500, {}) })
    await screen.findByRole('dialog', { name: COMMON_TEXT.newVariety })
    await new Promise((resolve) => setTimeout(resolve, 30))
    expectBehindPaneEmpty(behindPane())
  })

  test('opened from inside the app the sheet draws no pane: the app is already behind it', async () => {
    renderApp({ pathname: VARIETY_NEW, state: inAppState({ pathname: VARIETIES_PATH }) }, 'phone')
    await screen.findByRole('dialog', { name: COMMON_TEXT.newVariety })
    expect(document.querySelector('.behind-pane')).toBeNull()
  })

  test('a flip across 900 px keeps what was typed, on the same input', async () => {
    renderApp({ pathname: VARIETY_NEW }, 'phone')

    const name = await screen.findByRole('textbox', NAME)
    await userEvent.type(name, 'Blue Dream')
    flipViewport('computer')
    expect(screen.getByRole('textbox', NAME)).toBe(name)
    expect(name).toHaveValue('Blue Dream')
    flipViewport('phone')
    expect(screen.getByRole('textbox', NAME)).toBe(name)
    expect(name).toHaveValue('Blue Dream')
  })
})

describe('New variety on a computer', () => {
  test('it is the modal over the panes it always was: no pane of its own, no sheet, no pinned row', async () => {
    renderApp({ pathname: VARIETY_NEW }, 'computer')

    await screen.findByRole('textbox', NAME)
    expect(document.querySelector('.behind-pane')).toBeNull()
    expect(document.querySelector('.sheet')).toBeNull()
    expect(document.querySelector('.sheet__actions')).toBeNull()
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})

describe("a variety's inline edits on a phone", () => {
  test.each([
    ['rename', VARIETIES_TEXT.renombrarVariedad, COMMON_TEXT.saveTheName, () => screen.getByLabelText(COMMON_TEXT.name)],
    [
      'threshold',
      VARIETIES_TEXT.avisoDeStockBajo,
      VARIETIES_TEXT.guardaElAviso,
      () => screen.getByLabelText(VARIETIES_TEXT.avisarConMenosDe),
    ],
    [
      'catalog',
      VARIETIES_TEXT.enElCatalogo,
      VARIETIES_TEXT.guardaElCatalogo,
      // The first control in DOM order is the visibility switch, not a text field.
      () => screen.getByRole('switch', { name: VARIETIES_TEXT.mostrarEnElCatalogo }),
    ],
  ])('%s opens as a sheet over the page: first focus resolved, one Close, Save last, no pane', async (form, title, save, first) => {
    renderApp({ pathname: VARIETY_ONE, state: { form } }, 'phone')

    const dialog = await screen.findByRole('dialog', { name: title })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    await waitFor(() => expect(first()).toHaveFocus())
    expect(screen.getAllByRole('button', { name: COMMON_TEXT.close })).toHaveLength(1)
    expect(within(dialog).getByRole('button', { name: COMMON_TEXT.close })).toBeInTheDocument()
    // The page itself is behind the sheet: its own heading is still drawn, and no pane is.
    expect(screen.getByRole('heading', { name: '24K Gold' })).toBeInTheDocument()
    expect(document.querySelector('.behind-pane')).toBeNull()

    const actions = document.querySelector('.sheet__actions')
    expect(actions?.parentElement?.tagName).toBe('FORM')
    expect(actions?.nextElementSibling).toBeNull()
    expect(actionNames().at(-1)).toBe(save)
  })

  test('Close with nothing typed closes the sheet and leaves the page', async () => {
    const router = renderApp({ pathname: VARIETY_ONE }, 'phone')
    await screen.findByRole('heading', { name: '24K Gold' })
    await act(() => router.navigate(VARIETY_ONE, { state: { form: 'rename' } }))

    await userEvent.click(await screen.findByRole('button', { name: COMMON_TEXT.close }))

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(router.state.location.pathname).toBe(VARIETY_ONE)
  })

  test('Close with something typed asks the page\'s one question, and the sheet stays until answered', async () => {
    renderApp({ pathname: VARIETY_ONE, state: { form: 'rename' } }, 'phone')

    await userEvent.type(await screen.findByLabelText(COMMON_TEXT.name), 'x')
    await userEvent.click(screen.getByRole('button', { name: COMMON_TEXT.close }))

    expect(await screen.findByText(COMMON_TEXT.discardTheChange)).toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: VARIETIES_TEXT.renombrarVariedad })).toBeInTheDocument()
  })

  test('a flip across 900 px keeps what was typed in the rename form', async () => {
    renderApp({ pathname: VARIETY_ONE, state: { form: 'rename' } }, 'phone')

    const name = await screen.findByLabelText(COMMON_TEXT.name)
    await userEvent.type(name, ' Deluxe')
    flipViewport('computer')
    expect(screen.getByLabelText(COMMON_TEXT.name)).toBe(name)
    expect(name).toHaveValue('24K Gold Deluxe')
    flipViewport('phone')
    expect(screen.getByLabelText(COMMON_TEXT.name)).toBe(name)
    expect(name).toHaveValue('24K Gold Deluxe')
  })
})

describe("a variety's inline edits on a computer", () => {
  test('the form stays inline in the page, with no sheet, no dialog and no pinned row', async () => {
    renderApp({ pathname: VARIETY_ONE, state: { form: 'rename' } }, 'computer')

    await screen.findByLabelText(COMMON_TEXT.name)
    expect(document.querySelector('.sheet')).toBeNull()
    expect(document.querySelector('.sheet__actions')).toBeNull()
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
