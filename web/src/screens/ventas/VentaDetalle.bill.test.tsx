/**
 * The sale bill's Share/Copy on `VentaDetalle` at the screen seam: Testing Library with `fetch`
 * faked and `navigator.share`, the clipboard and `execCommand` stubbed at the browser API. The
 * text is always the bill of the last `GET /sales/{id}`; nothing of the PUT's answer is shown.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import SALE from '../../api/fixtures/sale-detail.json'
import { keys } from '../../api/keys'
import { saleJustSaved } from '../../components/feedback'
import { SheetRouterProvider } from '../../components/useSheetStack'
import { pathTo, SALE as SALE_ROUTE } from '../../routes'
import VentaDetalle from './VentaDetalle'

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

function renderDetalle(state?: unknown) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const router = createMemoryRouter([{ path: SALE_ROUTE, element: <VentaDetalle /> }], {
    initialEntries: [{ pathname: pathTo(SALE_ROUTE, { id: 10 }), state }],
  })
  render(
    <QueryClientProvider client={queryClient}>
      <SheetRouterProvider router={router}>
        <RouterProvider router={router} />
      </SheetRouterProvider>
    </QueryClientProvider>,
  )
  return queryClient
}

function setSecureContext(value: boolean) {
  Object.defineProperty(window, 'isSecureContext', { value, configurable: true })
}

/** The button of the loaded detail: the loading skeleton already holds a disabled one. */
async function readyButton(name: 'Share' | 'Copy'): Promise<HTMLElement> {
  await waitFor(() => expect(screen.getByRole('button', { name })).toBeEnabled())
  return screen.getByRole('button', { name })
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
  setSecureContext(true)
})

afterEach(() => {
  vi.unstubAllGlobals()
  Reflect.deleteProperty(navigator, 'share')
  Reflect.deleteProperty(document, 'execCommand')
})

const BILL_TEXT =
  'Flores del Sur\n14/09\n\nFlor A 3,5 g · $ 10.500\nShipping · $ 500\n\nTotal · $ 11.000\nStill owed on this sale: $ 11.000\nYour balance: $ 11.000'

test('Share sends the text of the bill the detail answered', async () => {
  const share = vi.fn(() => Promise.resolve())
  Object.defineProperty(navigator, 'share', { value: share, configurable: true })
  vi.mocked(fetch).mockResolvedValue(jsonResponse(200, SALE))
  renderDetalle()

  await userEvent.click(await readyButton('Share'))

  expect(share).toHaveBeenCalledWith({ text: BILL_TEXT })
})

test('over plain http Copy calls execCommand right in the click and the toast says Bill copied', async () => {
  setSecureContext(false)
  const execCommand = vi.fn(() => true)
  Object.defineProperty(document, 'execCommand', { value: execCommand, configurable: true })
  vi.mocked(fetch).mockResolvedValue(jsonResponse(200, SALE))
  renderDetalle()

  fireEvent.click(await readyButton('Copy'))

  expect(execCommand).toHaveBeenCalledWith('copy')
  expect(await screen.findByText('Bill copied')).toBeInTheDocument()
})

test('the button is the first of the actions, and never inside the Sale saved notice', async () => {
  vi.mocked(fetch).mockResolvedValue(jsonResponse(200, { ...SALE, customer: null }))
  renderDetalle(saleJustSaved())

  await screen.findByText('Sale of 14/09')
  const copy = screen.getByRole('button', { name: 'Copy' })
  const actions = copy.parentElement
  expect(actions?.firstElementChild).toBe(copy)
  expect(within(actions as HTMLElement).getByRole('button', { name: 'Assign customer' })).toBeInTheDocument()
  expect(copy.closest('.venta-guardada')).toBeNull()
})

test('a sale whose bill is null has no Share or Copy, and the rest of the detail shows', async () => {
  vi.mocked(fetch).mockResolvedValue(jsonResponse(200, { ...SALE, bill: null }))
  renderDetalle()

  expect(await screen.findByText('Sale of 14/09')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Copy' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Share' })).not.toBeInTheDocument()
})

test('while the detail loads the button is there, disabled and busy, with no digit or $', async () => {
  vi.mocked(fetch).mockReturnValue(new Promise<Response>(() => undefined))
  renderDetalle()

  const button = await screen.findByRole('button', { name: 'Copy' })
  expect(button).toBeDisabled()
  expect(button).toHaveAttribute('aria-busy', 'true')
  const body = button.closest('.cuerpo') as HTMLElement
  expect(body.closest('main')?.textContent ?? '').not.toMatch(/[0-9$]/)
  expect(body).toHaveAttribute('aria-busy', 'true')
})

test('a 404 still takes the not-found path, with no button', async () => {
  vi.mocked(fetch).mockResolvedValue(jsonResponse(404, { detail: 'x', code: 'sale.not_found' }))
  renderDetalle()

  await waitFor(() => expect(screen.queryByRole('button', { name: 'Copy' })).not.toBeInTheDocument())
  expect(screen.queryByText('Sale of 14/09')).not.toBeInTheDocument()
})

const NICO_SEARCH_RESULT = { id: 5, name: 'Nico', phone: '1111', vip: true }
const NICO = { id: 5, name: 'Nico', vip: true }

/** Serves the sale's reads from a queue the test controls, so a read can be held. */
function stubAssign(gets: (() => Promise<Response>)[]) {
  vi.mocked(fetch).mockImplementation((input, init) => {
    const url = typeof input === 'string' ? input : input.toString()
    const method = init?.method ?? 'GET'
    if (method === 'GET' && url === '/sales/10') {
      const next = gets.shift()
      if (next === undefined) throw new Error('no more GET /sales/10 queued')
      return next()
    }
    if (method === 'PUT') return Promise.resolve(jsonResponse(200, { ...SALE, customer: NICO }))
    return Promise.resolve(jsonResponse(200, url.startsWith('/customers') ? [NICO_SEARCH_RESULT] : []))
  })
}

async function chooseNico() {
  await screen.findByText('Sale of 14/09')
  await userEvent.click(screen.getByRole('button', { name: 'Assign customer' }))
  fireEvent.change(screen.getByPlaceholderText('Phone or name'), { target: { value: 'Nico' } })
  await userEvent.click(await screen.findByText('Nico'))
}

const NO_CUSTOMER = { ...SALE, customer: null, payment: 'none', bill: { ...SALE.bill, balance: null } }
const WITH_CUSTOMER = { ...SALE, customer: NICO, bill: { ...SALE.bill, balance: 41000 } }

test('after an assign the copied text ends with the balance of the second GET', async () => {
  setSecureContext(false)
  const copied: string[] = []
  Object.defineProperty(document, 'execCommand', {
    // `copyText` selects a temporary textarea holding the text, then calls this.
    value: vi.fn(() => {
      copied.push(document.querySelector('textarea')?.value ?? '')
      return true
    }),
    configurable: true,
  })
  stubAssign([() => Promise.resolve(jsonResponse(200, NO_CUSTOMER)), () => Promise.resolve(jsonResponse(200, WITH_CUSTOMER))])
  renderDetalle()
  await chooseNico()
  await screen.findByText('Customer assigned')

  fireEvent.click(await readyButton('Copy'))

  await screen.findByText('Bill copied')
  expect(copied).toHaveLength(1)
  expect(copied[0]?.endsWith('Your balance: $ 41.000')).toBe(true)
  expect(screen.queryByText('Customer assigned')).not.toBeInTheDocument()
})

test('a focus refetch that started before the assign leaves the button busy until the detail with the customer arrives', async () => {
  let releaseStale: (response: Response) => void = () => undefined
  let releaseFresh: (response: Response) => void = () => undefined
  stubAssign([
    () => Promise.resolve(jsonResponse(200, NO_CUSTOMER)),
    () => new Promise<Response>((resolve) => (releaseStale = resolve)),
    () => new Promise<Response>((resolve) => (releaseFresh = resolve)),
  ])
  const queryClient = renderDetalle()
  await screen.findByText('Sale of 14/09')
  // A refetch on focus starts before the PUT.
  await act(async () => {
    void queryClient.refetchQueries({ queryKey: keys.sale('10') })
  })
  await chooseNico()

  await act(async () => releaseStale(jsonResponse(200, NO_CUSTOMER)))
  expect(screen.getByRole('button', { name: 'Copy' })).toBeDisabled()

  await act(async () => releaseFresh(jsonResponse(200, WITH_CUSTOMER)))
  await waitFor(() => expect(screen.getByRole('button', { name: 'Copy' })).toBeEnabled())
})
