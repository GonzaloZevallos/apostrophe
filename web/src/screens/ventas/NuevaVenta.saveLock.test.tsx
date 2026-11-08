/**
 * `NuevaVenta` while a save is in flight, at the screen seam with `fetch` faked and
 * `POST /sales` held: the lines cannot be reached until the answer lands, and the focus
 * a save refusal asks for is applied once, after that lock lifts, and never again on a
 * later save. Routed through the real app, as `NuevaVenta.test.tsx` is.
 */

import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test, vi } from 'vitest'
import App from '../../App'
import { HOME, SALE, SALES, SALE_NEW } from '../../routes'
import { queryClient } from '../../queryClient'
import { router } from '../../router'
import { pickProduct, productField, productFieldName } from './lineProduct'

const ME = { email: 'ana@x.com', business_name: 'La Huerta', today: '2026-10-02' }
const ROSA = {
  id: 1,
  name: 'Rosa',
  current_price: { id: 9, effective_from: '2026-09-01', list_price: 1000, bulk_price: null, bulk_minimum: null },
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

/** Answers the held `POST /sales` the test is waiting on. */
let answerSave: ((response: Response) => void) | null = null
let varietiesCalls = 0

async function openForm(varieties: (call: number) => unknown): Promise<void> {
  varietiesCalls = 0
  answerSave = null
  vi.stubGlobal(
    'fetch',
    vi.fn((path: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET'
      if (method === 'GET' && path === '/auth/me') return Promise.resolve(jsonResponse(200, ME))
      if (method === 'GET' && path === '/api/products?on=2026-10-02') {
        varietiesCalls += 1
        return Promise.resolve(jsonResponse(200, varieties(varietiesCalls)))
      }
      if (method === 'POST' && path === '/sales') {
        return new Promise<Response>((resolve) => {
          answerSave = resolve
        })
      }
      return Promise.reject(new Error(`unexpected request: ${method} ${path}`))
    }),
  )
  await act(() => router.navigate(SALES))
  await act(() => router.navigate(SALE_NEW))
  render(<App />)
  await screen.findByText('New sale')
  await screen.findByRole('button', { name: productFieldName(1) })
  await waitFor(() => expect(varietiesCalls).toBeGreaterThan(0))
  await waitFor(() => expect(productField(1)).toBeEnabled())
}

async function held(): Promise<(response: Response) => void> {
  await waitFor(() => expect(answerSave).not.toBeNull())
  return answerSave as unknown as (response: Response) => void
}

async function fillAndSave(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await pickProduct(user, 1, 'Rosa')
  await user.type(screen.getByLabelText('Line 1 grams'), '2')
  await user.click(screen.getByRole('radio', { name: 'Cash' }))
  expect(await screen.findByText('list')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Save sale' }))
}

afterEach(async () => {
  vi.unstubAllGlobals()
  queryClient.clear()
  await act(() => router.navigate(HOME))
})

test('with the save held, the lines are inert and the rest of the form is not', async () => {
  const user = userEvent.setup()
  await openForm(() => [ROSA])
  await fillAndSave(user)
  const answer = await held()

  await waitFor(() => expect(screen.getByLabelText('Line 1 grams').closest('[inert]')).not.toBeNull())
  expect(screen.getByRole('button', { name: 'Save sale' }).closest('[inert]')).toBeNull()

  await act(async () => {
    answer(jsonResponse(422, { detail: 'no', code: 'sale.shipping_negative' }))
  })
  await waitFor(() => expect(screen.getByLabelText('Line 1 grams').closest('[inert]')).toBeNull())
})

test('a no-price refusal focuses the flagged line once the lock lifts', async () => {
  const user = userEvent.setup()
  // Rosa loses her price between the form's own fetch and the save.
  await openForm((call) => [call === 1 ? ROSA : { ...ROSA, current_price: null }])
  await fillAndSave(user)
  const answer = await held()
  expect(screen.getByLabelText('Line 1 grams').closest('[inert]')).not.toBeNull()

  await act(async () => {
    answer(jsonResponse(422, { detail: 'no price', code: 'sale.no_price_that_day' }))
  })

  expect(await screen.findByText('Rosa has no price for that date')).toBeInTheDocument()
  const field = productField(1)
  await waitFor(() => expect(document.activeElement).toBe(field))
  expect(field.closest('[inert]')).toBeNull()
})

test('a later save with another refusal does not pull focus back to the Product field', async () => {
  const user = userEvent.setup()
  await openForm((call) => [call === 1 ? ROSA : { ...ROSA, current_price: null }])
  await fillAndSave(user)
  const first = await held()
  await act(async () => {
    first(jsonResponse(422, { detail: 'no price', code: 'sale.no_price_that_day' }))
  })
  await waitFor(() => expect(document.activeElement).toBe(productField(1)))

  // A typed special price prices the line, so the next save reaches the API.
  answerSave = null
  const special = screen.getByLabelText('Line 1 special price')
  await user.type(special, '500')
  expect(document.activeElement).toBe(special)
  await user.click(screen.getByRole('button', { name: 'Save sale' }))
  const second = await held()
  await act(async () => {
    second(jsonResponse(422, { detail: 'no', code: 'sale.shipping_negative' }))
  })

  await waitFor(() => expect(screen.getByLabelText('Line 1 grams').closest('[inert]')).toBeNull())
  expect(document.activeElement).not.toBe(productField(1))
})

test('a successful save still navigates to the saved sale', async () => {
  const user = userEvent.setup()
  await openForm(() => [ROSA])
  await fillAndSave(user)
  const answer = await held()

  await act(async () => {
    answer(jsonResponse(201, { id: 77 }))
  })

  await waitFor(() => expect(router.state.location.pathname).toBe(SALE.replace(':id', '77')))
})
