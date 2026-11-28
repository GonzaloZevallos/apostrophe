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
import { MoneyFormatProvider } from '../../format/MoneyFormatProvider'

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
<MoneyFormatProvider format={{ symbol: '$', decimals: 0 }}>
      <SheetRouterProvider router={router}>
        <RouterProvider router={router} />
      </SheetRouterProvider>
    </MoneyFormatProvider>
</QueryClientProvider>,
  )
  return queryClient
}

function setSecureContext(value: boolean) {
  Object.defineProperty(window, 'isSecureContext', { value, configurable: true })
}

/** The title row's group, named by the h1 'Sale #N'. */
function titleRow(): HTMLElement {
  return screen.getByRole('group', { name: /^Sale #\d+$/ })
}

/** The Sale bill block's group. */
function billBlock(): HTMLElement {
  return screen.getByRole('group', { name: 'Sharing the bill' })
}

/** The title row's Share of the loaded detail, reached only through its group. */
async function readyShare(): Promise<HTMLElement> {
  const share = await within(await findTitleRow()).findByRole('button', { name: 'Share' })
  await waitFor(() => expect(share).toBeEnabled())
  return share
}

/** The block's Copy of the loaded detail: the loading state already holds a disabled one. */
async function readyCopy(): Promise<HTMLElement> {
  await screen.findByRole('heading', { level: 1, name: /^Sale #/ })
  const copy = within(billBlock()).getByRole('button', { name: 'Copy' })
  await waitFor(() => expect(copy).toBeEnabled())
  return copy
}

async function findTitleRow(): Promise<HTMLElement> {
  return screen.findByRole('group', { name: /^Sale #\d+$/ })
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
  'Flores del Sur\nSale #2 · 14/09\n\nFlor A 3,5 g · $ 10.500\nShipping · $ 500\n\nTotal · $ 11.000\nStill owed on this sale: $ 11.000\nYour balance: $ 11.000'

test('Share sends the text of the bill the detail answered', async () => {
  const share = vi.fn(() => Promise.resolve())
  Object.defineProperty(navigator, 'share', { value: share, configurable: true })
  vi.mocked(fetch).mockResolvedValue(jsonResponse(200, SALE))
  renderDetalle()

  await userEvent.click(await readyShare())

  expect(share).toHaveBeenCalledWith({ text: BILL_TEXT })
})

test('over plain http Copy calls execCommand right in the click and the toast says Bill copied', async () => {
  setSecureContext(false)
  const execCommand = vi.fn(() => true)
  Object.defineProperty(document, 'execCommand', { value: execCommand, configurable: true })
  vi.mocked(fetch).mockResolvedValue(jsonResponse(200, SALE))
  renderDetalle()

  fireEvent.click(await readyCopy())

  expect(execCommand).toHaveBeenCalledWith('copy')
  expect(await screen.findByText('Bill copied')).toBeInTheDocument()
})

test('the block follows the detail card, holds only Copy and sits outside the Sale saved notice', async () => {
  vi.mocked(fetch).mockResolvedValue(jsonResponse(200, { ...SALE, customer: null }))
  renderDetalle(saleJustSaved())

  await screen.findByRole('heading', { level: 1, name: 'Sale #2' })
  const block = billBlock()
  const detail = screen.getByRole('region', { name: 'Detail' })
  expect(detail.compareDocumentPosition(block) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(within(block).getAllByRole('button')).toHaveLength(1)
  expect(within(block).queryByRole('button', { name: 'Assign customer' })).not.toBeInTheDocument()
  expect(within(screen.getByRole('status')).queryByRole('button', { name: 'Copy' })).not.toBeInTheDocument()
})

test('the block reads Copy, never Share, while the title row offers the one Share', async () => {
  Object.defineProperty(navigator, 'share', { value: vi.fn(() => Promise.resolve()), configurable: true })
  vi.mocked(fetch).mockResolvedValue(jsonResponse(200, SALE))
  renderDetalle()

  await readyShare()
  expect(within(billBlock()).getByRole('button', { name: 'Copy' })).toBeInTheDocument()
  expect(within(billBlock()).queryByRole('button', { name: 'Share' })).not.toBeInTheDocument()
  expect(screen.getAllByRole('button', { name: 'Share' })).toHaveLength(1)
})

test('without a way to share the title row has no Share and the block still copies', async () => {
  vi.mocked(fetch).mockResolvedValue(jsonResponse(200, SALE))
  renderDetalle()

  await readyCopy()
  expect(screen.queryByRole('button', { name: 'Share' })).not.toBeInTheDocument()
})

test('after a failed share the title row has no Share, the notice shows, and Copy succeeds and clears it', async () => {
  const share = vi.fn(() => Promise.reject(new Error('boom')))
  Object.defineProperty(navigator, 'share', { value: share, configurable: true })
  const execCommand = vi.fn(() => true)
  Object.defineProperty(document, 'execCommand', { value: execCommand, configurable: true })
  vi.mocked(fetch).mockResolvedValue(jsonResponse(200, SALE))
  renderDetalle()

  await userEvent.click(await readyShare())
  setSecureContext(false) // the Copy that follows takes the plain-http path.

  expect(await screen.findByText("Couldn't share. Tap Copy and paste it into the chat.")).toBeInTheDocument()
  expect(within(titleRow()).queryByRole('button', { name: 'Share' })).not.toBeInTheDocument()
  expect(within(billBlock()).getByRole('button', { name: 'Copy' })).toBeEnabled()

  fireEvent.click(within(billBlock()).getByRole('button', { name: 'Copy' }))

  expect(execCommand).toHaveBeenCalledWith('copy')
  expect(await screen.findByText('Bill copied')).toBeInTheDocument()
  expect(screen.queryByText("Couldn't share. Tap Copy and paste it into the chat.")).not.toBeInTheDocument()
})

test('a failed copy shows the bill text by hand in a region named Sale bill, inside the block', async () => {
  setSecureContext(false)
  Object.defineProperty(document, 'execCommand', { value: vi.fn(() => false), configurable: true })
  vi.mocked(fetch).mockResolvedValue(jsonResponse(200, SALE))
  renderDetalle()

  fireEvent.click(await readyCopy())

  const region = await screen.findByRole('region', { name: 'Sale bill' })
  expect(region.textContent).toBe(BILL_TEXT)
  expect(billBlock()).toContainElement(region)
})

test('a sale whose bill is null has no Share or Copy, and the rest of the detail shows', async () => {
  Object.defineProperty(navigator, 'share', { value: vi.fn(() => Promise.resolve()), configurable: true })
  vi.mocked(fetch).mockResolvedValue(jsonResponse(200, { ...SALE, bill: null }))
  renderDetalle()

  expect(await screen.findByText('Sale #2')).toBeInTheDocument()
  expect(screen.queryByRole('group', { name: 'Sharing the bill' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Copy' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Share' })).not.toBeInTheDocument()
})

test('while the detail loads the button is there, disabled and busy, with no digit or $', async () => {
  vi.mocked(fetch).mockReturnValue(new Promise<Response>(() => undefined))
  renderDetalle()

  const button = await screen.findByRole('button', { name: 'Copy' })
  expect(button).toBeDisabled()
  expect(button).toHaveAttribute('aria-busy', 'true')
  const main = screen.getByRole('main')
  expect(main.textContent ?? '').not.toMatch(/[0-9$]/)
  expect(main).toHaveAttribute('aria-busy', 'true')
})

test('the title and the first line of the bill after the business name show the same number', async () => {
  const share = vi.fn((_data: { text: string }) => Promise.resolve())
  Object.defineProperty(navigator, 'share', { value: share, configurable: true })
  vi.mocked(fetch).mockResolvedValue(
    jsonResponse(200, { ...SALE, number: 77, bill: { ...SALE.bill, number: 77 } }),
  )
  renderDetalle()

  expect(await screen.findByText('Sale #77')).toBeInTheDocument()
  await userEvent.click(await readyShare())

  const sent = share.mock.calls[0]?.[0]
  expect(sent?.text.split('\n')[1]).toBe('Sale #77 · 14/09')
})

test('a 404 still takes the not-found path, with no button', async () => {
  vi.mocked(fetch).mockResolvedValue(jsonResponse(404, { detail: 'x', code: 'sale.not_found' }))
  renderDetalle()

  await waitFor(() => expect(screen.queryByRole('button', { name: 'Copy' })).not.toBeInTheDocument())
  expect(screen.queryByText('Sale #2')).not.toBeInTheDocument()
})

const NICO_SEARCH_RESULT = { id: 5, name: 'Nico', phone: '1111', phone_display: '1111', vip: true }
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
  await screen.findByText('Sale #2')
  await userEvent.click(screen.getByRole('button', { name: 'Assign customer' }))
  fireEvent.change(screen.getByPlaceholderText('Phone or name'), { target: { value: 'Nico' } })
  await userEvent.click(await screen.findByText('Nico'))
}

const NO_CUSTOMER = { ...SALE, customer: null, bill: { ...SALE.bill, balance: null } }
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

  fireEvent.click(await readyCopy())

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
  await screen.findByText('Sale #2')
  // A refetch on focus starts before the PUT.
  await act(async () => {
    void queryClient.refetchQueries({ queryKey: keys.sale('10') })
  })
  await chooseNico()

  await act(async () => releaseStale(jsonResponse(200, NO_CUSTOMER)))
  expect(within(billBlock()).getByRole('button', { name: 'Copy' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Assign customer' })).toBeDisabled()

  await act(async () => releaseFresh(jsonResponse(200, WITH_CUSTOMER)))
  await waitFor(() => expect(within(billBlock()).getByRole('button', { name: 'Copy' })).toBeEnabled())
})
