/**
 * New sale's how-paid at the screen seam: the real app and router, `fetch` faked. The Payment
 * method is a required Selector under Paid only; a refused save draws its sentence at the field
 * and sends nothing; a $0 sale needs no method; the list is its own history entry on the phone.
 */

import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { choosePaid, choosePaymentMethod } from '../../components/selectorTestKit'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import App from '../../App'
import { stubViewport } from '../../test-viewport'
import { sheetDepth } from '../../components/useSheetStack'
import { queryClient } from '../../queryClient'
import { HOME, SALES, SALE_NEW } from '../../routes'
import { router } from '../../router'
import { pickProduct } from './lineProduct'
import { METHODS_ANSWER, withPaymentMethods } from '../../test-payment-methods'

const ME = { email: 'ana@x.com', business_name: 'La Huerta', today: '2026-10-02', money: { symbol: '$', decimals: 0 } }
const ANA = { id: 7, name: 'Ana', phone: '+5491100000001', phone_display: '+54 9 11 0000-0001', vip: false }

function price(list: number) {
  return { id: 9, effective_from: '2026-09-01', list_price: list, bulk_price: null, bulk_minimum: null, vip_price: null }
}

const ROSA = { id: 1, name: 'Rosa', archived: false, current_price: price(1000) }
const FREE = { id: 3, name: 'Regalo', archived: false, current_price: price(0) }
function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

function stubShop(): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn((path: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET'
    if (method === 'GET' && path === '/auth/me') return Promise.resolve(jsonResponse(200, ME))
    if (method === 'GET' && path.startsWith('/api/products?on=')) {
      return Promise.resolve(jsonResponse(200, [ROSA, FREE]))
    }
    if (method === 'GET' && path === '/pricing-settings') {
      return Promise.resolve(jsonResponse(200, { is_bulk_pricing: false, is_vip_customers: false }))
    }
    if (method === 'GET' && path === '/customers') return Promise.resolve(jsonResponse(200, [ANA]))
    if (method === 'POST' && path === '/sales') return Promise.resolve(jsonResponse(201, { id: 77 }))
    const url = path.split('?')[0]
    if (method === 'GET' && url === '/sales') return Promise.resolve(jsonResponse(200, []))
    return Promise.reject(new Error(`unexpected request: ${method} ${path}`))
  })
  vi.stubGlobal('fetch', withPaymentMethods(fetchMock))
  return fetchMock
}

function posted(fetchMock: ReturnType<typeof vi.fn>): RequestInit[] {
  return fetchMock.mock.calls
    .filter(([path, init]) => path === '/sales' && (init as RequestInit | undefined)?.method === 'POST')
    .map(([, init]) => init as RequestInit)
}

async function openSale(): Promise<void> {
  await act(() => router.navigate(SALES))
  await act(() => router.navigate(SALE_NEW))
  render(<App />)
  await screen.findByText('New sale')
  await screen.findByLabelText('Line 1 grams')
}

function depth(): number {
  return sheetDepth(router.state.location.state)
}

beforeEach(() => stubViewport('computer'))

afterEach(async () => {
  vi.unstubAllGlobals()
  queryClient.clear()
  await act(() => router.navigate(HOME))
})

test('the method is a Selector with Cash and Transfer under Paid only, with no radio, no pressed button and no clearing row', async () => {
  const user = userEvent.setup()
  stubShop()
  await openSale()
  expect(screen.queryByRole('button', { name: /^Payment method/ })).not.toBeInTheDocument()

  await choosePaid(user)
  expect(document.querySelector('[aria-pressed]')).toBeNull()
  expect(screen.queryByRole('radio', { name: 'Cash' })).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: /^Payment method/ }))
  expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual(['Cash', 'Transfer'])
})

test('Owing is disabled with its description when there is no Customer, and shows no method field once chosen', async () => {
  const user = userEvent.setup()
  stubShop()
  await openSale()
  expect(screen.getByRole('radio', { name: 'Owing' })).toBeDisabled()
  expect(screen.getByRole('radio', { name: 'Owing' })).toHaveAccessibleDescription(
    'To leave it owing, pick a customer',
  )
  await user.click(screen.getByRole('button', { name: 'Pick a customer' }))
  await user.click(await screen.findByRole('button', { name: /Ana/ }))
  await user.click(await screen.findByRole('radio', { name: 'Owing' }))
  expect(screen.queryByRole('button', { name: /^Payment method/ })).not.toBeInTheDocument()
})

test('saving under Paid above $0 with no method is refused at the field: sentence, focus, nothing sent', async () => {
  const user = userEvent.setup()
  const fetchMock = stubShop()
  await openSale()
  await pickProduct(user, 1, 'Rosa')
  await user.type(screen.getByLabelText('Line 1 grams'), '2')
  await choosePaid(user)

  const save = screen.getByRole('button', { name: 'Save sale' })
  await user.click(save)

  const alert = await screen.findByText('Choose how they paid.')
  expect(alert).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /^Payment method/ })).toHaveFocus()
  expect(posted(fetchMock)).toHaveLength(0)
  // Never entered the pending state: Save is enabled and the lines are not locked (`inert`).
  expect(save).toBeEnabled()
  expect(screen.getByLabelText('Line 1 grams').closest('[inert]')).toBeNull()
  expect(screen.getByRole('button', { name: /^Payment method/ }).closest('[inert]')).toBeNull()

  await choosePaymentMethod(user, 'Transfer')
  expect(screen.queryByText('Choose how they paid.')).not.toBeInTheDocument()
  await user.click(save)
  await waitFor(() => expect(posted(fetchMock)).toHaveLength(1))
  expect(JSON.parse(posted(fetchMock)[0]!.body as string)).toMatchObject({ payment: { kind: 'paid', payment_method_id: 2 } })
})

test('a Paid sale of $0 saves with no method, and sends none', async () => {
  const user = userEvent.setup()
  const fetchMock = stubShop()
  await openSale()
  await pickProduct(user, 1, 'Regalo')
  await user.type(screen.getByLabelText('Line 1 grams'), '2')
  await choosePaid(user)
  await user.click(screen.getByRole('button', { name: 'Save sale' }))
  await waitFor(() => expect(posted(fetchMock)).toHaveLength(1))
  expect(JSON.parse(posted(fetchMock)[0]!.body as string)).toMatchObject({ payment: null })
  expect(screen.queryByText('Choose how they paid.')).not.toBeInTheDocument()
})

test('Paid → Owing → Paid empties the method, and a stale method is never sent', async () => {
  const user = userEvent.setup()
  stubShop()
  await openSale()
  await user.click(screen.getByRole('button', { name: 'Pick a customer' }))
  await user.click(await screen.findByRole('button', { name: /Ana/ }))
  await choosePaid(user)
  await choosePaymentMethod(user, 'Cash')
  expect(screen.getByRole('button', { name: /^Payment method/ })).toHaveTextContent('Cash')

  await user.click(await screen.findByRole('radio', { name: 'Owing' }))
  await user.click(screen.getByRole('radio', { name: 'Paid' }))
  expect(screen.getByRole('button', { name: /^Payment method/ })).not.toHaveTextContent('Cash')
})

test('Paid alone, or Paid with a method, leaves a blank sale without asking; a line makes it ask', async () => {
  const user = userEvent.setup()
  stubShop()
  await openSale()
  await choosePaid(user)
  await choosePaymentMethod(user, 'Cash')
  await act(() => router.navigate(-1))
  await waitFor(() => expect(router.state.location.pathname).toBe(SALES))
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()

  await act(() => router.navigate(SALE_NEW))
  await screen.findByLabelText('Line 1 grams')
  await user.type(screen.getByLabelText('Line 1 grams'), '3')
  await act(() => router.navigate(-1))
  expect(await screen.findByRole('alertdialog')).toBeInTheDocument()
})

test('on the phone the method list is its own history entry: back closes only the list, and the form is inert while it is open', async () => {
  stubViewport('phone')
  const user = userEvent.setup()
  stubShop()
  await openSale()
  await choosePaid(user)
  const path = router.state.location.pathname
  expect(depth()).toBe(0)

  await user.click(screen.getByRole('button', { name: /^Payment method/ }))
  const list = await screen.findByRole('dialog', { name: 'Payment method options' })
  expect(depth()).toBe(1)
  expect(list.closest('[inert]')).toBeNull()
  expect(document.querySelector('form[inert]')).not.toBeNull()

  await act(() => router.navigate(-1))
  await waitFor(() => expect(list).not.toBeInTheDocument())
  expect(depth()).toBe(0)
  expect(router.state.location.pathname).toBe(path)
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  expect(document.querySelector('form[inert]')).toBeNull()

  await choosePaymentMethod(user, 'Cash')
  expect(screen.getByRole('button', { name: /^Payment method/ })).toHaveTextContent('Cash')
  await waitFor(() => expect(document.querySelector('form[inert]')).toBeNull())
  expect(within(document.body).queryByRole('dialog', { name: 'Payment method options' })).not.toBeInTheDocument()
})

test('on the phone a line Product list open makes the method field inert, and closing it frees the field', async () => {
  stubViewport('phone')
  const user = userEvent.setup()
  stubShop()
  await openSale()
  await choosePaid(user)
  const method = screen.getByRole('button', { name: /^Payment method/ })
  expect(method.closest('[inert]')).toBeNull()

  await waitFor(() => expect(screen.getByRole('button', { name: /^Line 1 product/ })).toBeEnabled())
  await user.click(screen.getByRole('button', { name: /^Line 1 product/ }))
  const list = await screen.findByRole('dialog', { name: 'Line 1 product options' })
  expect(depth()).toBe(1)
  expect(list.closest('[inert]')).toBeNull()
  expect(method.closest('[inert]')).not.toBeNull()

  await act(() => router.navigate(-1))
  await waitFor(() => expect(list).not.toBeInTheDocument())
  expect(depth()).toBe(0)
  expect(method.closest('[inert]')).toBeNull()
})

test('on a computer the first Escape closes only the method dropdown; the second reaches the page, which does nothing', async () => {
  const user = userEvent.setup()
  stubShop()
  await openSale()
  await choosePaid(user)
  const path = router.state.location.pathname
  const method = screen.getByRole('button', { name: /^Payment method/ })

  await user.click(method)
  expect(await screen.findByRole('listbox', { name: 'Payment method options' })).toBeInTheDocument()
  const onDocument = vi.fn()
  document.addEventListener('keydown', onDocument)
  try {
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(method).toHaveFocus()
    expect(onDocument).not.toHaveBeenCalled()
    expect(router.state.location.pathname).toBe(path)
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()

    await user.keyboard('{Escape}')
    expect(onDocument).toHaveBeenCalledTimes(1)
  } finally {
    document.removeEventListener('keydown', onDocument)
  }
  // New sale has no Escape of its own: the form stays, nothing is asked, nothing is chosen.
  expect(router.state.location.pathname).toBe(path)
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  expect(method).not.toHaveTextContent('Cash')
})

test('a 404 payment_method.unavailable keeps the form and the chosen method, marked as no longer available', async () => {
  const user = userEvent.setup()
  let offered = METHODS_ANSWER
  const fetchMock = vi.fn((path: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET'
    if (method === 'POST' && path === '/sales') {
      offered = METHODS_ANSWER.filter((item) => item.name !== 'Transfer')
      return Promise.resolve(jsonResponse(404, { detail: 'gone', code: 'payment_method.unavailable' }))
    }
    if (method === 'GET' && path === '/auth/me') return Promise.resolve(jsonResponse(200, ME))
    if (method === 'GET' && path.startsWith('/api/products?on=')) return Promise.resolve(jsonResponse(200, [ROSA, FREE]))
    if (method === 'GET' && path === '/pricing-settings') {
      return Promise.resolve(jsonResponse(200, { is_bulk_pricing: false, is_vip_customers: false }))
    }
    if (method === 'GET' && path === '/customers') return Promise.resolve(jsonResponse(200, [ANA]))
    const url = path.split('?')[0]
    if (method === 'GET' && url === '/sales') return Promise.resolve(jsonResponse(200, []))
    return Promise.reject(new Error(`unexpected request: ${method} ${path}`))
  })
  vi.stubGlobal('fetch', withPaymentMethods(fetchMock, () => offered))
  await openSale()
  await pickProduct(user, 1, 'Rosa')
  await user.type(screen.getByLabelText('Line 1 grams'), '2')
  await choosePaid(user)
  await choosePaymentMethod(user, 'Transfer')
  await user.click(screen.getByRole('button', { name: 'Save sale' }))

  const field = screen.getByRole('button', { name: /^Payment method/ })
  await waitFor(() => expect(field).toHaveTextContent('Transfer'))
  await waitFor(() => expect(field).toHaveTextContent('no longer available'))
  expect(
    screen.getByText('That payment method is no longer available. Choose another one.'),
  ).toBeInTheDocument()
  expect(screen.queryByText('Choose how they paid.')).not.toBeInTheDocument()
  expect(screen.getByLabelText('Line 1 grams')).toHaveValue('2')

  await choosePaymentMethod(user, 'Cash')
  expect(screen.queryByText('That payment method is no longer available. Choose another one.')).not.toBeInTheDocument()
  expect(field).toHaveTextContent('Cash')
})
