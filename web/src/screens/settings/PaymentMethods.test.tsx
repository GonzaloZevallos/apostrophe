import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, describe, expect, test, vi } from 'vitest'
import fixture from '../../api/fixtures/payment-methods.json'
import { PAYMENT_METHODS_TEXT as T } from '../../copy/paymentMethods'
import { HOME } from '../../routes'
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

/** A faked API that answers each write with `refusal` (a code, with its status) when given. */
function fakeApi(calls: Call[], options: { archived?: unknown; refusal?: { code: string; status: number } } = {}) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const method = init?.method ?? 'GET'
      const url = String(input)
      const body = typeof init?.body === 'string' ? (JSON.parse(init.body) as unknown) : undefined
      calls.push({ url, method, body })
      if (method === 'GET') {
        const list = url.endsWith('/archived') ? (options.archived ?? []) : fixture
        return new Response(JSON.stringify(list), { status: 200, headers: { 'Content-Type': 'application/json' } })
      }
      if (options.refusal !== undefined) {
        return new Response(JSON.stringify({ code: options.refusal.code, detail: 'x' }), {
          status: options.refusal.status,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      return new Response(method === 'DELETE' || url.endsWith('/archive') ? null : JSON.stringify(fixture[0]), {
        status: method === 'DELETE' || url.endsWith('/archive') ? 204 : 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }),
  )
}

function writes(calls: Call[]): Call[] {
  return calls.filter((call) => call.method !== 'GET')
}

function renderScreen() {
  const router = createMemoryRouter([{ path: HOME, element: <PaymentMethods /> }])
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

describe('the management flow', () => {
  test('adding sends the typed name and the chosen icon', async () => {
    const calls: Call[] = []
    fakeApi(calls)
    renderScreen()
    await userEvent.click(await screen.findByRole('button', { name: T.add }))
    await userEvent.type(screen.getByRole('textbox', { name: T.nameLabel }), 'Card')
    await userEvent.click(screen.getByRole('radio', { name: /Bank/ }))
    await userEvent.click(screen.getByRole('button', { name: T.save }))
    await waitFor(() => expect(writes(calls)).toHaveLength(1))
    expect(writes(calls)[0]).toMatchObject({ url: '/api/payment-methods', method: 'POST', body: { name: 'Card', icon: 'bank' } })
  })

  test('renaming sends only the name; changing the icon sends only the icon', async () => {
    const calls: Call[] = []
    fakeApi(calls)
    renderScreen()
    await userEvent.click(await screen.findByRole('button', { name: 'Edit Cash' }))
    await userEvent.type(screen.getByRole('textbox', { name: T.nameLabel }), 's')
    await userEvent.click(screen.getByRole('button', { name: T.save }))
    await waitFor(() => expect(writes(calls)).toHaveLength(1))
    expect(writes(calls)[0]).toMatchObject({ url: '/api/payment-methods/1', method: 'PATCH', body: { name: 'Cashs' } })

    await userEvent.click(await screen.findByRole('button', { name: 'Edit Transfer' }))
    await userEvent.click(screen.getByRole('radio', { name: /Card/ }))
    await userEvent.click(screen.getByRole('button', { name: T.save }))
    await waitFor(() => expect(writes(calls)).toHaveLength(2))
    expect(writes(calls)[1]).toMatchObject({ url: '/api/payment-methods/2', method: 'PATCH', body: { icon: 'card' } })
  })

  test('Move up sends the direction up for that method', async () => {
    const calls: Call[] = []
    fakeApi(calls)
    renderScreen()
    await userEvent.click(await screen.findByRole('button', { name: 'Move Mercado Pago up' }))
    await waitFor(() => expect(writes(calls)).toHaveLength(1))
    expect(writes(calls)[0]).toMatchObject({ url: '/api/payment-methods/3/move', body: { direction: 'up' } })
  })

  test('Archive posts to /archive without asking first', async () => {
    const calls: Call[] = []
    fakeApi(calls)
    renderScreen()
    await userEvent.click(await screen.findByRole('button', { name: 'Edit Cash' }))
    await userEvent.click(screen.getByRole('button', { name: T.archive }))
    await waitFor(() => expect(writes(calls)).toHaveLength(1))
    expect(writes(calls)[0]).toMatchObject({ url: '/api/payment-methods/1/archive', method: 'POST' })
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })

  test('the Archived row shows how many methods are archived', async () => {
    fakeApi([], { archived: [fixture[1]] })
    renderScreen()
    const row = await screen.findByRole('link', { name: /Archived/ })
    await waitFor(() => expect(row.textContent).toContain('1'))
  })

  test.each([
    ['payment_method.name_empty', 422, T.errorNameEmpty],
    ['payment_method.name_too_long', 422, T.errorNameTooLong],
    ['payment_method.last_active', 409, T.errorLastActive],
    ['payment_method.in_use', 409, T.errorInUse],
  ])('%s is shown under the field with its own words', async (code, status, words) => {
    fakeApi([], { refusal: { code, status } })
    renderScreen()
    await userEvent.click(await screen.findByRole('button', { name: 'Edit Cash' }))
    await userEvent.type(screen.getByRole('textbox', { name: T.nameLabel }), 'x')
    await userEvent.click(screen.getByRole('button', { name: T.save }))
    expect((await screen.findByRole('alert')).textContent).toContain(words)
  })

  test('a method that is gone closes the Sheet, says so and reads the list again', async () => {
    const calls: Call[] = []
    fakeApi(calls, { refusal: { code: 'payment_method.not_found', status: 404 } })
    renderScreen()
    await userEvent.click(await screen.findByRole('button', { name: 'Edit Cash' }))
    const reads = (): number => calls.filter((call) => call.method === 'GET' && call.url === '/api/payment-methods').length
    const before = reads()
    await userEvent.click(screen.getByRole('button', { name: T.archive }))
    expect((await screen.findByRole('alert')).textContent).toBe(T.errorNotFound)
    expect(screen.queryByRole('textbox', { name: T.nameLabel })).toBeNull()
    await waitFor(() => expect(reads()).toBeGreaterThan(before))
  })

  test('reopening a method right after saving its icon shows the saved icon', async () => {
    let methods: unknown[] = fixture.map((method) => ({ ...method }))
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const method = init?.method ?? 'GET'
        const headers = { 'Content-Type': 'application/json' }
        if (method === 'PATCH') {
          methods = fixture.map((entry) => (entry.id === 1 ? { ...entry, icon: 'wallet' } : { ...entry }))
          return new Response(JSON.stringify(methods[0]), { status: 200, headers })
        }
        const list = String(input).endsWith('/archived') ? [] : methods
        return new Response(JSON.stringify(list), { status: 200, headers })
      }),
    )
    renderScreen()
    await userEvent.click(await screen.findByRole('button', { name: 'Edit Cash' }))
    await userEvent.click(screen.getByRole('radio', { name: /Wallet/ }))
    await userEvent.click(screen.getByRole('button', { name: T.save }))
    await waitFor(() => expect(screen.queryByRole('textbox', { name: T.nameLabel })).toBeNull())
    await userEvent.click(screen.getByRole('button', { name: 'Edit Cash' }))
    expect(screen.getByRole('radio', { name: /Wallet/ }).getAttribute('aria-checked')).toBe('true')
  })
})
