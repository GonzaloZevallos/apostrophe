/**
 * Settings → Payments and expenses → Payment methods, through Testing Library with `fetch`
 * faked by a small in-memory server: the group row, the list, the Form Sheet (new and edit,
 * reopened after a save), each name refusal, move, archive, restore, delete and the
 * last-offered refusal.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Outlet, RouterProvider, createMemoryRouter } from 'react-router'
import { afterEach, expect, test, vi } from 'vitest'
import type { Me } from '../../api/me'
import type { PaymentMethodItem } from '../../api/paymentMethods'
import { inAppState } from '../../components/inAppState'
import {
  SETTINGS,
  SETTINGS_PAYMENTS,
  SETTINGS_PAYMENT_METHODS,
  SETTINGS_PAYMENT_METHODS_ARCHIVED,
} from '../../routes'
import { SHOWN_EN } from '../../test/shownLanguage'
import PaymentMethods from './PaymentMethods'
import PaymentMethodsArchived from './PaymentMethodsArchived'
import PaymentsGroup from './PaymentsGroup'

const ME: Me = { email: 'vos@lahuerta.com', business_name: 'La Huerta', today: '2026-10-02', shown_language: SHOWN_EN, money: { symbol: '$', decimals: 0 } }

const method = (id: number, name: string, icon: PaymentMethodItem['icon'], in_use = false): PaymentMethodItem => ({
  id,
  name,
  icon,
  position: id,
  in_use,
})

function json(status: number, body: unknown): Response {
  return new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

interface Server {
  offered: PaymentMethodItem[]
  archived: PaymentMethodItem[]
  calls: string[]
  /** A refusal to answer the next write with, as `status:code`. */
  refuse?: string
}

function serve(server: Server): (url: string, init?: RequestInit) => Promise<Response> {
  return (url, init) => {
    const verb = init?.method ?? 'GET'
    const body = (init?.body === undefined ? {} : JSON.parse(String(init.body))) as Record<string, string>
    server.calls.push(`${verb} ${url}`)
    if (verb !== 'GET' && server.refuse !== undefined) {
      const [status, code] = server.refuse.split(':')
      server.refuse = undefined
      return Promise.resolve(json(Number(status), { code }))
    }
    const id = Number(url.split('/')[3])
    const at = server.offered.findIndex((m) => m.id === id)
    if (verb === 'GET' && url === '/api/payment-methods') return Promise.resolve(json(200, server.offered))
    if (verb === 'GET' && url === '/api/payment-methods/archived') return Promise.resolve(json(200, server.archived))
    if (verb === 'POST' && url === '/api/payment-methods') {
      const added = method(server.offered.length + server.archived.length + 1, body['name'] ?? '', (body['icon'] ?? 'other') as PaymentMethodItem['icon'])
      server.offered.push(added)
      return Promise.resolve(json(201, added))
    }
    if (verb === 'PATCH') {
      const current = server.offered[at]
      if (current === undefined) return Promise.resolve(json(404, { code: 'payment_method.not_found' }))
      const saved = { ...current, name: body['name'] ?? current.name, icon: (body['icon'] ?? current.icon) as PaymentMethodItem['icon'] }
      server.offered[at] = saved
      return Promise.resolve(json(200, saved))
    }
    if (verb === 'POST' && url.endsWith('/move')) {
      const swap = body['direction'] === 'up' ? at - 1 : at + 1
      const a = server.offered[at]
      const b = server.offered[swap]
      if (a !== undefined && b !== undefined) {
        server.offered[at] = b
        server.offered[swap] = a
      }
      return Promise.resolve(json(200, server.offered))
    }
    if (verb === 'POST' && url.endsWith('/archive')) {
      server.archived.push(...server.offered.splice(at, 1))
      return Promise.resolve(json(204, null))
    }
    if (verb === 'POST' && url.endsWith('/restore')) {
      const from = server.archived.findIndex((m) => m.id === id)
      server.offered.push(...server.archived.splice(from, 1))
      return Promise.resolve(json(204, null))
    }
    if (verb === 'DELETE') {
      server.offered.splice(at, 1)
      return Promise.resolve(json(204, null))
    }
    return Promise.resolve(json(500, {}))
  }
}

function renderAt(path: string, server: Server) {
  vi.stubGlobal('fetch', vi.fn(serve(server)))
  const router = createMemoryRouter(
    [
      {
        element: <Outlet context={ME} />,
        children: [
          { path: SETTINGS, element: <div>Lista de grupos</div> },
          { path: SETTINGS_PAYMENTS, element: <PaymentsGroup /> },
          { path: SETTINGS_PAYMENT_METHODS, element: <PaymentMethods /> },
          { path: SETTINGS_PAYMENT_METHODS_ARCHIVED, element: <PaymentMethodsArchived /> },
        ],
      },
    ],
    { initialEntries: [SETTINGS, { pathname: path, state: inAppState({ pathname: SETTINGS }) }], initialIndex: 1 },
  )
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
}

const fresh = (): Server => ({
  offered: [method(1, 'Cash', 'banknote', true), method(2, 'Transfer', 'bank')],
  archived: [],
  calls: [],
})

test('the group row names the offered methods in order', async () => {
  renderAt(SETTINGS_PAYMENTS, fresh())

  expect(await screen.findByText('Cash, Transfer')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: /Payment methods/ })).toBeInTheDocument()
})

test('lists the methods with move, edit and delete or archive named after each', async () => {
  renderAt(SETTINGS_PAYMENT_METHODS, fresh())

  expect(await screen.findByText('Cash')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Move Cash down' })).toBeEnabled()
  expect(screen.getByRole('button', { name: 'Move Cash up' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Edit Transfer' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Archive Cash' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Delete Transfer' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Delete Cash' })).not.toBeInTheDocument()
})

test('adds a method with the chosen icon and shows it last', async () => {
  const server = fresh()
  renderAt(SETTINGS_PAYMENT_METHODS, server)
  await userEvent.click(await screen.findByRole('button', { name: 'Add method' }))
  await userEvent.type(screen.getByRole('textbox', { name: 'Name' }), 'Mercado Pago')
  await userEvent.click(screen.getByRole('radio', { name: 'Phone' }))
  await userEvent.click(screen.getByRole('button', { name: 'Save' }))

  expect(await screen.findByText('Mercado Pago')).toBeInTheDocument()
  expect(server.offered[2]).toMatchObject({ name: 'Mercado Pago', icon: 'phone' })
  expect(screen.queryByRole('form', { name: 'New payment method' })).not.toBeInTheDocument()
})

test('a new method starts on the neutral Other icon', async () => {
  renderAt(SETTINGS_PAYMENT_METHODS, fresh())
  await userEvent.click(await screen.findByRole('button', { name: 'Add method' }))

  expect(screen.getByRole('radio', { name: 'Other' })).toBeChecked()
})

test('an edit Sheet reopened after a save reads the saved name and icon', async () => {
  renderAt(SETTINGS_PAYMENT_METHODS, fresh())
  await userEvent.click(await screen.findByRole('button', { name: 'Edit Transfer' }))
  expect(screen.getByText('Past payments will show the new name.')).toBeInTheDocument()
  const name = screen.getByRole('textbox', { name: /Name/ })
  await userEvent.clear(name)
  await userEvent.type(name, 'Wire')
  await userEvent.click(screen.getByRole('radio', { name: 'Wallet' }))
  await userEvent.click(screen.getByRole('button', { name: 'Save' }))
  await userEvent.click(await screen.findByRole('button', { name: 'Edit Wire' }))

  expect(screen.getByRole('textbox', { name: /Name/ })).toHaveValue('Wire')
  expect(screen.getByRole('radio', { name: 'Wallet' })).toBeChecked()
  expect(screen.getByRole('radio', { name: 'Bank' })).not.toBeChecked()
})

test.each([
  ['422:payment_method.name_required', 'Give the method a name.'],
  ['422:payment_method.name_too_long', 'Use 60 characters or fewer.'],
  ['409:payment_method.name_taken', 'You already have a method with that name.'],
  ['409:payment_method.name_taken_archived', 'An archived method already has that name. Restore it from Archived.'],
])('a refused name (%s) shows its text and keeps the form and what was typed', async (refuse, text) => {
  const server = fresh()
  renderAt(SETTINGS_PAYMENT_METHODS, server)
  await userEvent.click(await screen.findByRole('button', { name: 'Add method' }))
  await userEvent.type(screen.getByRole('textbox', { name: 'Name' }), 'Cash')
  server.refuse = refuse
  await userEvent.click(screen.getByRole('button', { name: 'Save' }))

  expect(await screen.findByText(text)).toBeInTheDocument()
  expect(screen.getByRole('textbox', { name: 'Name' })).toHaveValue('Cash')
})

test('moving a method down reorders the list from the server answer', async () => {
  const server = fresh()
  renderAt(SETTINGS_PAYMENT_METHODS, server)
  await userEvent.click(await screen.findByRole('button', { name: 'Move Cash down' }))

  expect(await screen.findByRole('button', { name: 'Move Cash up' })).toBeEnabled()
  expect(server.calls).toContain('POST /api/payment-methods/1/move')
  expect(server.offered.map((m) => m.name)).toEqual(['Transfer', 'Cash'])
})

test('archiving asks first, then the method leaves the list and shows in Archived', async () => {
  const server = fresh()
  renderAt(SETTINGS_PAYMENT_METHODS, server)
  await userEvent.click(await screen.findByRole('button', { name: 'Archive Cash' }))
  expect(
    screen.getByRole('alertdialog', {
      name: 'Archive Cash? It stops being offered for new payments. Past payments keep showing it.',
    }),
  ).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Archive' }))

  expect(await screen.findByRole('button', { name: 'Delete Transfer' })).toBeInTheDocument()
  expect(screen.queryByText('Cash')).not.toBeInTheDocument()
  expect(server.archived.map((m) => m.name)).toEqual(['Cash'])
})

test('keeping a method at the confirmation changes nothing', async () => {
  const server = fresh()
  renderAt(SETTINGS_PAYMENT_METHODS, server)
  await userEvent.click(await screen.findByRole('button', { name: 'Delete Transfer' }))
  await userEvent.click(screen.getByRole('button', { name: 'Keep it' }))

  expect(screen.getByText('Transfer')).toBeInTheDocument()
  expect(server.calls).toEqual(['GET /api/payment-methods'])
})

test('deleting a method with no payments asks first and removes it for good', async () => {
  const server = fresh()
  renderAt(SETTINGS_PAYMENT_METHODS, server)
  await userEvent.click(await screen.findByRole('button', { name: 'Delete Transfer' }))
  expect(screen.getByRole('alertdialog', { name: 'Delete Transfer for good?' })).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Delete' }))

  await vi.waitFor(() => expect(screen.queryByText('Transfer')).not.toBeInTheDocument())
  expect(server.calls).toContain('DELETE /api/payment-methods/2')
})

test('the last offered method cannot go: the refusal says why and the list stays', async () => {
  const server: Server = { offered: [method(1, 'Cash', 'banknote', true)], archived: [], calls: [] }
  renderAt(SETTINGS_PAYMENT_METHODS, server)
  await userEvent.click(await screen.findByRole('button', { name: 'Archive Cash' }))
  server.refuse = '409:payment_method.last_offered'
  await userEvent.click(screen.getByRole('button', { name: 'Archive' }))

  expect(
    await screen.findByText('You need at least one payment method. Add another one first.'),
  ).toBeInTheDocument()
  expect(screen.getByText('Cash')).toBeInTheDocument()
})

test('a method that vanished meanwhile shows the gone notice and refreshes', async () => {
  const server = fresh()
  renderAt(SETTINGS_PAYMENT_METHODS, server)
  await userEvent.click(await screen.findByRole('button', { name: 'Delete Transfer' }))
  server.refuse = '404:payment_method.not_found'
  await userEvent.click(screen.getByRole('button', { name: 'Delete' }))

  expect(await screen.findByRole('status')).toBeInTheDocument()
})

test('the Archived screen restores a method by name', async () => {
  const server: Server = { offered: [method(1, 'Cash', 'banknote')], archived: [method(3, 'Wallet app', 'wallet', true)], calls: [] }
  renderAt(SETTINGS_PAYMENT_METHODS_ARCHIVED, server)
  await userEvent.click(await screen.findByRole('button', { name: 'Restore Wallet app' }))

  expect(await screen.findByText('No archived payment methods.')).toBeInTheDocument()
  expect(server.offered.map((m) => m.name)).toEqual(['Cash', 'Wallet app'])
})

test('the Archived screen says so when there is none', async () => {
  renderAt(SETTINGS_PAYMENT_METHODS_ARCHIVED, fresh())

  expect(await screen.findByText('No archived payment methods.')).toBeInTheDocument()
})
