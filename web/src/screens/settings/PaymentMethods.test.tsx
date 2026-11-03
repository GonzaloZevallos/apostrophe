import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, describe, expect, test, vi } from 'vitest'
import fixture from '../../api/fixtures/payment-methods.json'
import PaymentMethods from './PaymentMethods'

type Call = { url: string; method: string; body: unknown }

function fakeFetch(calls: Call[], methods: unknown = fixture) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const method = init?.method ?? 'GET'
      const body = typeof init?.body === 'string' ? (JSON.parse(init.body) as unknown) : undefined
      calls.push({ url: String(input), method, body })
      const status = method === 'GET' ? 200 : 204
      return new Response(method === 'GET' ? JSON.stringify(methods) : null, {
        status,
        headers: { 'Content-Type': 'application/json' },
      })
    }),
  )
}

function renderScreen() {
  const router = createMemoryRouter([{ path: '/', element: <PaymentMethods /> }])
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
}

afterEach(() => vi.unstubAllGlobals())

describe('the Payment methods screen', () => {
  test('the first row has no Move up and the last has no Move down', async () => {
    fakeFetch([])
    renderScreen()
    await screen.findByRole('button', { name: 'Edit Cash' })
    expect(screen.queryByRole('button', { name: 'Move Cash up' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Move Cash down' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Move Mercado Pago up' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Move Mercado Pago down' })).toBeNull()
  })

  test('Move down sends the direction of that method', async () => {
    const calls: Call[] = []
    fakeFetch(calls)
    renderScreen()
    await userEvent.click(await screen.findByRole('button', { name: 'Move Cash down' }))
    await waitFor(() => expect(calls.some((call) => call.method === 'POST')).toBe(true))
    const move = calls.find((call) => call.method === 'POST')
    expect(move?.url).toBe('/api/payment-methods/1/move')
    expect(move?.body).toEqual({ direction: 'down' })
  })

  test('a method in use offers Archive, and an unused one offers Delete with a confirmation', async () => {
    const calls: Call[] = []
    fakeFetch(calls)
    renderScreen()
    await userEvent.click(await screen.findByRole('button', { name: 'Edit Cash' }))
    expect(screen.getByRole('button', { name: 'Archive' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Close' }))

    await userEvent.click(screen.getByRole('button', { name: 'Edit Mercado Pago' }))
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(screen.getByRole('alertdialog', { name: 'Delete Mercado Pago?' })).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: 'Yes, delete it' }))
    await waitFor(() => expect(calls.some((call) => call.method === 'DELETE')).toBe(true))
    expect(calls.find((call) => call.method === 'DELETE')?.url).toBe('/api/payment-methods/3')
  })

  test('the last active method shows the sentence in place of Archive and Delete', async () => {
    fakeFetch([], [fixture[0]])
    renderScreen()
    await userEvent.click(await screen.findByRole('button', { name: 'Edit Cash' }))
    expect(screen.getByText('This is your only method. Add another one first.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Archive' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull()
  })

  test('a duplicate name is refused under the field with its own words', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) =>
        (init?.method ?? 'GET') === 'GET'
          ? new Response(JSON.stringify(fixture), { status: 200, headers: { 'Content-Type': 'application/json' } })
          : new Response(JSON.stringify({ code: 'payment_method.name_taken', detail: 'x' }), {
              status: 422,
              headers: { 'Content-Type': 'application/json' },
            }),
      ),
    )
    renderScreen()
    await userEvent.click(await screen.findByRole('button', { name: '+ Add method' }))
    await userEvent.type(screen.getByRole('textbox', { name: 'Name' }), 'cash')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect((await screen.findByRole('alert')).textContent).toContain('That name is taken')
  })

  test('the chosen icon is marked with the word Selected, not by colour alone', async () => {
    fakeFetch([])
    renderScreen()
    await userEvent.click(await screen.findByRole('button', { name: '+ Add method' }))
    await userEvent.click(screen.getByRole('radio', { name: /Bank/ }))
    expect(screen.getByRole('radio', { name: /Bank.*Selected/ })).toBeTruthy()
  })
})
