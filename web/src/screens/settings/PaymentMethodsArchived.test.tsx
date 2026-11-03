import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, describe, expect, test, vi } from 'vitest'
import fixture from '../../api/fixtures/payment-methods.json'
import { PAYMENT_METHODS_TEXT } from '../../copy/paymentMethods'
import { HOME } from '../../routes'
import PaymentMethodsArchived from './PaymentMethodsArchived'

type Call = { url: string; method: string }

function fakeFetch(calls: Call[], archived: unknown, restoreStatus = 204) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const method = init?.method ?? 'GET'
      calls.push({ url: String(input), method })
      if (method === 'GET') {
        return new Response(JSON.stringify(archived), { status: 200, headers: { 'Content-Type': 'application/json' } })
      }
      if (restoreStatus === 204) return new Response(null, { status: 204 })
      return new Response(JSON.stringify({ code: 'payment_method.not_found', detail: 'x' }), {
        status: restoreStatus,
        headers: { 'Content-Type': 'application/json' },
      })
    }),
  )
}

function renderScreen() {
  const router = createMemoryRouter([{ path: HOME, element: <PaymentMethodsArchived /> }])
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
}

afterEach(() => vi.unstubAllGlobals())

describe('the Archived payment methods view', () => {
  test('lists the plain names and restores one by its name', async () => {
    const calls: Call[] = []
    fakeFetch(calls, [fixture[1]])
    renderScreen()
    await userEvent.click(await screen.findByRole('button', { name: `Restore ${fixture[1]!.name}` }))
    await waitFor(() => expect(calls.some((call) => call.method === 'POST')).toBe(true))
    expect(calls.find((call) => call.method === 'POST')?.url).toBe(`/api/payment-methods/${fixture[1]!.id}/restore`)
  })

  test('says so when nothing is archived', async () => {
    fakeFetch([], [])
    renderScreen()
    expect(await screen.findByText(PAYMENT_METHODS_TEXT.archivedEmpty)).toBeTruthy()
  })

  test('a refused restore says it could not be restored', async () => {
    fakeFetch([], [fixture[1]], 404)
    renderScreen()
    await userEvent.click(await screen.findByRole('button', { name: `Restore ${fixture[1]!.name}` }))
    expect((await screen.findByRole('alert')).textContent).toBe(PAYMENT_METHODS_TEXT.restoreFailed)
  })
})
