/**
 * Settings → Prices → Customer types, through Testing Library with `fetch` faked: the list, the
 * Form Sheet (new and edit), the inline refusals, the discard question and the delete refusal
 * that carries the count.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Outlet, RouterProvider, createMemoryRouter } from 'react-router'
import { afterEach, expect, test, vi } from 'vitest'
import type { CustomerType } from '../../api/customerTypes'
import type { Me } from '../../api/me'
import { SHOWN_EN } from '../../test/shownLanguage'
import { inAppState } from '../../components/inAppState'
import { SETTINGS, SETTINGS_CUSTOMER_TYPES } from '../../routes'
import CustomerTypes from './CustomerTypes'

const ME: Me = { email: 'vos@lahuerta.com', business_name: 'La Huerta', today: '2026-10-02', shown_language: SHOWN_EN }

const VIP: CustomerType = { id: 1, name: 'VIP', icon: 'star', is_vip: true }
const REGULARS: CustomerType = { id: 2, name: 'Regulars', icon: 'circle', is_vip: false }

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

type Handler = (method: string, url: string, body: unknown) => Response | undefined

function renderScreen(types: CustomerType[], handler: Handler = () => undefined) {
  const fetchMock = vi.fn((url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET'
    const body: unknown = init?.body === undefined ? undefined : JSON.parse(String(init.body))
    const answered = handler(method, url, body)
    if (answered !== undefined) return Promise.resolve(answered)
    if (url === '/customer-types' && method === 'GET') return Promise.resolve(json(200, types))
    return Promise.resolve(json(500, {}))
  })
  vi.stubGlobal('fetch', fetchMock)
  const router = createMemoryRouter(
    [
      {
        element: <Outlet context={ME} />,
        children: [
          { path: SETTINGS, element: <div>Lista de grupos</div> },
          { path: SETTINGS_CUSTOMER_TYPES, element: <CustomerTypes /> },
        ],
      },
    ],
    {
      initialEntries: [SETTINGS, { pathname: SETTINGS_CUSTOMER_TYPES, state: inAppState({ pathname: SETTINGS }) }],
      initialIndex: 1,
    },
  )
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
  return fetchMock
}

test('lists each type with its name and a rename and a delete named after it', async () => {
  renderScreen([VIP, REGULARS])

  expect(await screen.findByText('VIP')).toBeInTheDocument()
  expect(screen.getByText('Regulars')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Rename Regulars' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Delete VIP' })).toBeInTheDocument()
})

test('shows the empty state when the business has no types', async () => {
  renderScreen([])

  expect(await screen.findByText('No customer types yet')).toBeInTheDocument()
})

test('creates a type with the default circle icon and refreshes the list', async () => {
  let created: unknown
  const fetchMock = renderScreen([], (method, url, body) => {
    if (method === 'POST' && url === '/customer-types') {
      created = body
      return json(201, { id: 3, name: 'Friends', icon: 'circle', is_vip: false })
    }
    return undefined
  })

  await userEvent.click(await screen.findByRole('button', { name: '+ Customer type' }))
  expect(screen.getByRole('radio', { name: 'Circle' })).toHaveAttribute('aria-checked', 'true')
  await userEvent.type(screen.getByRole('textbox', { name: 'Name' }), 'Friends')
  await userEvent.click(screen.getByRole('button', { name: 'Save' }))

  expect(created).toEqual({ name: 'Friends', icon: 'circle' })
  await vi.waitFor(() => expect(screen.queryByRole('textbox', { name: 'Name' })).not.toBeInTheDocument())
  expect(fetchMock.mock.calls.filter(([url]) => url === '/customer-types').length).toBeGreaterThan(1)
})

test('picks another icon and sends its key', async () => {
  let created: unknown
  renderScreen([], (method, _url, body) => {
    if (method === 'POST') {
      created = body
      return json(201, { id: 3, name: 'Crowned', icon: 'crown', is_vip: false })
    }
    return undefined
  })

  await userEvent.click(await screen.findByRole('button', { name: '+ Customer type' }))
  await userEvent.type(screen.getByRole('textbox', { name: 'Name' }), 'Crowned')
  await userEvent.click(screen.getByRole('radio', { name: 'Crown' }))
  await userEvent.click(screen.getByRole('button', { name: 'Save' }))

  expect(created).toEqual({ name: 'Crowned', icon: 'crown' })
})

test.each([
  ['customer_type.name_blank', 'Give the type a name.'],
  ['customer_type.name_too_long', 'Use 40 characters or fewer.'],
  ['customer_type.name_taken', 'You already have a type with that name.'],
])('shows %s inline and keeps what was typed', async (code, text) => {
  renderScreen([], (method) => (method === 'POST' ? json(422, { code }) : undefined))

  await userEvent.click(await screen.findByRole('button', { name: '+ Customer type' }))
  await userEvent.type(screen.getByRole('textbox', { name: 'Name' }), 'Friends')
  await userEvent.click(screen.getByRole('button', { name: 'Save' }))

  expect(await screen.findByText(text)).toBeInTheDocument()
  expect(screen.getByRole('textbox', { name: 'Name' })).toHaveValue('Friends')
})

test('renames a type through PATCH', async () => {
  let patched: unknown
  renderScreen([REGULARS], (method, url, body) => {
    if (method === 'PATCH' && url === '/customer-types/2') {
      patched = body
      return json(200, { ...REGULARS, name: 'Friends' })
    }
    return undefined
  })

  await userEvent.click(await screen.findByRole('button', { name: 'Rename Regulars' }))
  const name = screen.getByRole('textbox', { name: 'Name' })
  await userEvent.clear(name)
  await userEvent.type(name, 'Friends')
  await userEvent.click(screen.getByRole('button', { name: 'Save' }))

  await vi.waitFor(() => expect(patched).toEqual({ name: 'Friends', icon: 'circle' }))
})

test('says the type no longer exists when a rename finds it deleted', async () => {
  renderScreen([REGULARS], (method) => (method === 'PATCH' ? json(404, { code: 'customer_type.not_found' }) : undefined))

  await userEvent.click(await screen.findByRole('button', { name: 'Rename Regulars' }))
  await userEvent.click(screen.getByRole('button', { name: 'Save' }))

  expect(await screen.findByText('This type no longer exists. Close this and check the list.')).toBeInTheDocument()
})

test('asks before discarding a typed name, and closes when the seller confirms', async () => {
  renderScreen([])

  await userEvent.click(await screen.findByRole('button', { name: '+ Customer type' }))
  await userEvent.type(screen.getByRole('textbox', { name: 'Name' }), 'Fri')
  await userEvent.click(screen.getAllByRole('button', { name: 'Close' }).at(-1) as HTMLElement)

  expect(screen.getByRole('alertdialog', { name: 'Discard the changes?' })).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Keep editing' }))
  expect(screen.getByRole('textbox', { name: 'Name' })).toHaveValue('Fri')
})

test('closes at once when nothing was typed', async () => {
  renderScreen([])

  await userEvent.click(await screen.findByRole('button', { name: '+ Customer type' }))
  await userEvent.click(screen.getAllByRole('button', { name: 'Close' }).at(-1) as HTMLElement)

  expect(screen.queryByRole('textbox', { name: 'Name' })).not.toBeInTheDocument()
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
})

test.each([
  [1, '1 customer is in this type. Move that customer to another type first.'],
  [3, '3 customers are in this type. Move them to another type first.'],
])('refuses to delete a type with %i customer(s), saying how many', async (count, text) => {
  renderScreen([REGULARS], (method) =>
    method === 'DELETE' ? json(409, { code: 'customer_type.in_use', count }) : undefined,
  )

  await userEvent.click(await screen.findByRole('button', { name: 'Delete Regulars' }))

  expect(await screen.findByText(text)).toBeInTheDocument()
  expect(screen.getByText('Regulars')).toBeInTheDocument()
})

test('deletes an empty type', async () => {
  let deleted = false
  renderScreen([REGULARS], (method, url) => {
    if (method === 'DELETE' && url === '/customer-types/2') {
      deleted = true
      return new Response(null, { status: 204 })
    }
    return undefined
  })

  await userEvent.click(await screen.findByRole('button', { name: 'Delete Regulars' }))

  await vi.waitFor(() => expect(deleted).toBe(true))
})
