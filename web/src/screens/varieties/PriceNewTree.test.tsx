/**
 * The price form's modal at the tree seam: the app's real route table
 * (`appRouter.routes`) rendered with `fetch` faked. On a computer `/varieties/{id}/prices/new`
 * is a dialog over the list and the variety's page and the side rail, all inert and `aria-hidden`; on a phone
 * it is the full form screen. Every way out of the dialog is the host's one leave.
 *
 * jsdom does not implement `inert`: these tests prove the attribute is on both panes, and
 * `web/e2e/priceModal.spec.ts` proves in a browser that nothing behind can be reached.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RouterProvider, createMemoryRouter } from 'react-router'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { router as appRouter } from '../../router'
import { VARIETY, VARIETY_PRICE_NEW, pathTo } from '../../routes'
import { flipViewport, renderWithViewport } from '../../test-viewport'
import type { Viewport } from '../../routes'
import { ME, SETTINGS_ON, VARIETY_ROW, HISTORY, jsonResponse } from './renderVarieties'

const VARIETY_PATH = pathTo(VARIETY, { id: 1 })
const NEW_PATH = pathTo(VARIETY_PRICE_NEW, { id: 1 })

const STOCK = {
  total: 135,
  varieties: [{ variety_id: 1, grams: 135, status: 'ok', sold_out_since: null, threshold: null, days_left: 270 }],
  entries: [],
}
const FIRST_RUN_NONE = { kind: 'none', checklist: [], import_notice: false, nothing_qualifies: false }
const CATALOG = { text: 'texto', header: '', footer: '', varieties: [] }

type Answers = Record<string, () => Response>

function defaults(): Answers {
  return {
    'GET /auth/me': () => jsonResponse(200, ME),
    'GET /varieties': () => jsonResponse(200, [VARIETY_ROW]),
    'GET /varieties?archived=true': () => jsonResponse(200, []),
    'GET /varieties/1': () => jsonResponse(200, VARIETY_ROW),
    'GET /varieties/1/prices': () => jsonResponse(200, HISTORY),
    'GET /pricing-settings': () => jsonResponse(200, SETTINGS_ON),
    'GET /stock': () => jsonResponse(200, STOCK),
    'GET /stock/varieties/1/movements': () => jsonResponse(200, []),
    'GET /catalog': () => jsonResponse(200, CATALOG),
    'GET /first-run': () => jsonResponse(200, FIRST_RUN_NONE),
  }
}

function renderApp(entries: string[], viewport: Viewport, answers: Answers = {}) {
  const table = { ...defaults(), ...answers }
  const fetchMock = vi.fn((url: string, init?: RequestInit) => {
    const answer = table[`${init?.method ?? 'GET'} ${url}`]
    if (answer === undefined) return Promise.reject(new Error(`unexpected request: ${init?.method ?? 'GET'} ${url}`))
    return Promise.resolve(answer())
  })
  vi.stubGlobal('fetch', fetchMock)
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const router = createMemoryRouter(appRouter.routes, { initialEntries: entries, initialIndex: entries.length - 1 })
  renderWithViewport(viewport, () =>
    render(
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    ),
  )
  return { router, fetchMock }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('on a computer', () => {
  test('a direct link opens the form as a dialog over the list and the variety page, both inert and aria-hidden', async () => {
    renderApp([NEW_PATH], 'computer')

    const dialog = await screen.findByRole('dialog', { name: 'New price' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    const list = document.querySelector('.variedades-paneles__lista')
    const detail = document.querySelector('.variedades-paneles__detalle')
    for (const pane of [list, detail]) {
      expect(pane).not.toBeNull()
      expect(pane).toHaveAttribute('inert')
      expect(pane).toHaveAttribute('aria-hidden', 'true')
      expect(pane).not.toContainElement(dialog)
    }
    // The form kind's chrome: no side rail at all on a computer (invariant 8).
    expect(document.querySelector('nav.riel-lateral')).toBeNull()
    expect(await within(detail as HTMLElement).findByText('Prices')).toBeInTheDocument()
  })
})

const DISCARD_QUESTION = '¿Descartás el precio?'

function backdrop(): HTMLElement {
  const frame = document.querySelector<HTMLElement>('.precio-modal')
  if (frame === null) throw new Error('no backdrop')
  return frame
}

describe('on a phone', () => {
  test('the form is a full screen: no dialog, and no pane behind it', async () => {
    renderApp([NEW_PATH], 'phone')

    expect(await screen.findByRole('button', { name: 'Guardá el precio' })).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(document.querySelector('.variedades-paneles__lista')).toBeNull()
    expect(document.querySelector('.variedades-paneles__detalle')).toBeNull()
    expect(document.querySelector('[inert]')).toBeNull()
    expect(document.querySelector('nav.riel-lateral')).not.toBeNull()
  })

  test('Escape does nothing: the phone has no dialog to dismiss', async () => {
    const user = userEvent.setup()
    const { router } = renderApp([NEW_PATH], 'phone')
    await screen.findByRole('button', { name: 'Guardá el precio' })

    await user.keyboard('{Escape}')

    expect(router.state.location.pathname).toBe(NEW_PATH)
  })
})

describe('leaving an untouched form', () => {
  test.each([
    ['Escape with focus on body', async (user: ReturnType<typeof userEvent.setup>) => {
      ;(document.activeElement as HTMLElement | null)?.blur()
      await user.keyboard('{Escape}')
    }],
    ['a click on the backdrop', async (user: ReturnType<typeof userEvent.setup>) => user.click(backdrop())],
    ['Close', async (user: ReturnType<typeof userEvent.setup>) => user.click(screen.getByRole('button', { name: 'Close' }))],
  ])('%s lands on the variety page at once, a direct link included', async (_name, gesture) => {
    const warn = vi.spyOn(console, 'warn')
    const user = userEvent.setup()
    const { router } = renderApp([NEW_PATH], 'computer')
    await screen.findByLabelText(/^Precio de lista/)

    await gesture(user)

    expect(await screen.findByRole('link', { name: 'New price' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe(VARIETY_PATH)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.queryByText(DISCARD_QUESTION)).not.toBeInTheDocument()
    // A router supports one blocker, and warns at a navigation when two are registered: the
    // page behind the dialog holds none of its own.
    expect(warn).not.toHaveBeenCalled()
  })

  test('a click inside the dialog is not a click on the backdrop', async () => {
    const user = userEvent.setup()
    const { router } = renderApp([NEW_PATH], 'computer')
    await screen.findByLabelText(/^Precio de lista/)
    const dialog = screen.getByRole('dialog', { name: 'New price' })

    await user.click(within(dialog).getByText('New price'))

    expect(router.state.location.pathname).toBe(NEW_PATH)
  })
})

describe('leaving a form with something typed', () => {
  test.each([
    ['Escape', async (user: ReturnType<typeof userEvent.setup>) => user.keyboard('{Escape}')],
    ['a click on the backdrop', async (user: ReturnType<typeof userEvent.setup>) => user.click(backdrop())],
    ['Close', async (user: ReturnType<typeof userEvent.setup>) => user.click(screen.getByRole('button', { name: 'Close' }))],
  ])('%s asks first, and "No, keep entering" keeps the form with everything typed', async (_name, gesture) => {
    const user = userEvent.setup()
    const { router } = renderApp([VARIETY_PATH, NEW_PATH], 'computer')
    await user.type(await screen.findByLabelText(/^Precio de lista/), '12000')

    await gesture(user)

    expect(await screen.findByText(DISCARD_QUESTION)).toBeInTheDocument()
    expect(router.state.location.pathname).toBe(NEW_PATH)
    await user.click(screen.getByRole('button', { name: 'No, keep entering' }))
    expect(screen.queryByText(DISCARD_QUESTION)).not.toBeInTheDocument()
    expect(screen.getByLabelText(/^Precio de lista/)).toHaveValue('12000')
  })

  test('the question is a sibling of the dialog, and a second Escape while it asks does nothing', async () => {
    const user = userEvent.setup()
    const { router } = renderApp([NEW_PATH], 'computer')
    await user.type(await screen.findByLabelText(/^Precio de lista/), '12000')
    const dialog = screen.getByRole('dialog', { name: 'New price' })

    await user.keyboard('{Escape}')
    const question = await screen.findByRole('alertdialog')
    const navigate = vi.spyOn(router, 'navigate')
    await user.keyboard('{Escape}')
    await user.click(backdrop())

    expect(navigate).not.toHaveBeenCalled()

    expect(dialog).not.toContainElement(question)
    expect(screen.getByRole('alertdialog')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe(NEW_PATH)
  })

  test('"No, keep entering" gives focus back to where it was, or to the title when that is gone', async () => {
    const user = userEvent.setup()
    renderApp([NEW_PATH], 'computer')
    const field = await screen.findByLabelText(/^Precio de lista/)
    await user.type(field, '12000')
    expect(field).toHaveFocus()

    await user.keyboard('{Escape}')
    await screen.findByText(DISCARD_QUESTION)
    await user.click(screen.getByRole('button', { name: 'No, keep entering' }))
    expect(field).toHaveFocus()

    ;(document.activeElement as HTMLElement).blur()
    await user.click(backdrop())
    await screen.findByText(DISCARD_QUESTION)
    await user.click(screen.getByRole('button', { name: 'No, keep entering' }))
    expect(screen.getByText('New price', { selector: '.gasto-form__titulo' })).toHaveFocus()
  })

  test('"Yes, discard it" lands on the variety page', async () => {
    const user = userEvent.setup()
    const { router } = renderApp([NEW_PATH], 'computer')
    await user.type(await screen.findByLabelText(/^Precio de lista/), '12000')
    await user.keyboard('{Escape}')

    await user.click(await screen.findByRole('button', { name: 'Yes, discard it' }))

    expect(await screen.findByRole('link', { name: 'New price' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe(VARIETY_PATH)
  })
})

describe('saving', () => {
  const CREATED = () =>
    jsonResponse(201, { id: 4, effective_from: '2026-10-02', list_price: 12000, bulk_price: null, bulk_minimum: null })

  test('with the save in flight Escape, the backdrop and Cerrar change nothing; resolving lands on the page with one toast and the new entry', async () => {
    const user = userEvent.setup()
    let release: (response: Response) => void = () => undefined
    let saved = false
    const { router } = renderApp([VARIETY_PATH, NEW_PATH], 'computer', {
      'POST /varieties/1/prices': () => {
        throw new Error('replaced below')
      },
      'GET /varieties/1/prices': () =>
        jsonResponse(
          200,
          saved
            ? [{ id: 4, effective_from: '2026-10-02', list_price: 12000, bulk_price: null, bulk_minimum: null, vip_price: null }, ...HISTORY]
            : HISTORY,
        ),
    })
    vi.stubGlobal(
      'fetch',
      ((original) =>
        vi.fn((url: string, init?: RequestInit) => {
          if (init?.method === 'POST') {
            return new Promise<Response>((resolve) => {
              release = (response) => {
                saved = true
                resolve(response)
              }
            })
          }
          return original(url, init)
        }))(globalThis.fetch),
    )
    await user.type(await screen.findByLabelText(/^Precio de lista/), '12000')
    await user.click(screen.getByRole('button', { name: 'Guardá el precio' }))

    await user.keyboard('{Escape}')
    await user.click(backdrop())
    expect(screen.getByRole('button', { name: 'Close' })).toBeDisabled()
    expect(router.state.location.pathname).toBe(NEW_PATH)
    expect(screen.queryByText(DISCARD_QUESTION)).not.toBeInTheDocument()

    release(CREATED())

    expect(await screen.findByRole('link', { name: 'New price' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe(VARIETY_PATH)
    expect(await screen.findAllByText('Precio guardado')).toHaveLength(1)
    expect(await screen.findByText('$ 12.000')).toBeInTheDocument()
  })

  test('a refusal keeps the modal open with everything typed', async () => {
    const user = userEvent.setup()
    const { router } = renderApp([NEW_PATH], 'computer', {
      'POST /varieties/1/prices': () => jsonResponse(409, { code: 'price_date_taken' }),
    })
    await user.type(await screen.findByLabelText(/^Precio de lista/), '12000')
    await user.click(screen.getByRole('button', { name: 'Guardá el precio' }))

    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'New price' })).toBeInTheDocument()
    expect(screen.getByLabelText(/^Precio de lista/)).toHaveValue('12000')
    expect(router.state.location.pathname).toBe(NEW_PATH)
  })
})

describe('across 900 px', () => {
  test('a chosen day, the open choice and the typed price survive the flip, with the form kept mounted', async () => {
    const user = userEvent.setup()
    renderApp([NEW_PATH], 'computer')
    await user.type(await screen.findByLabelText(/^Precio de lista/), '12000')
    await user.click(screen.getByRole('button', { name: /^Today 02\/10/ }))
    fireEvent.change(screen.getByLabelText('Rige desde', { exact: true }), { target: { value: '2026-09-28' } })
    await user.click(screen.getByRole('button', { name: '28/09' }))
    const form = screen.getByRole('button', { name: 'Guardá el precio' }).closest('form')

    flipViewport('phone')

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Guardá el precio' }).closest('form')).toBe(form)
    expect(screen.getByRole('button', { name: '28/09' })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByLabelText('Rige desde', { exact: true })).toHaveValue('2026-09-28')
    expect(screen.getByLabelText(/^Precio de lista/)).toHaveValue('12000')
  })
})
