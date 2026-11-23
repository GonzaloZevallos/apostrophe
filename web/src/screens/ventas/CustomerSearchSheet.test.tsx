/**
 * The New sale customer search Sheet, through an unexported parent that holds what the flip part of
 * GH-496 will: the real `useSaleDraft`, the sheet stack over a memory router, and a stand-in for the
 * second-level sheet Create opens. Testing Library, the API faked at `fetch` (`GET /customers`).
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { Customer } from '../../api/customers'
import { SheetRouterProvider, SheetStackProvider, useSheet } from '../../components/useSheetStack'
import { useSaleDraft } from '../../sales/useSaleDraft'
import CustomerSearchSheet from './CustomerSearchSheet'

function customer(id: number, name: string, phoneDisplay: string | null = null, vip = false): Customer {
  return {
    id,
    name,
    phone: phoneDisplay === null ? null : phoneDisplay.replace(/\D/g, ''),
    phone_display: phoneDisplay,
    vip,
    customer_type_id: null,
    balance: 0,
    owing_since: null,
    standing: 'none',
  }
}

const ANA = customer(1, 'Ana Pérez', '+54 9 11 0000-0001')
const LUCIA = customer(2, 'Lucía Gómez', '+54 9 11 2222-3333')
const LUIS = customer(3, 'Luis Ramos')
const ZOE = customer(4, 'Zoe Luna', '+54 9 11 4444-5555')
const ALL = [ANA, LUCIA, LUIS, ZOE]

type Recent = { status: 'loading' | 'ready'; ids: number[] }

const calls = { created: [] as string[], withoutCustomer: 0 }
let requests: string[] = []
let answers: Customer[][] = []

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })
}

function stubCustomers(...responses: Customer[][]): void {
  answers = responses
  requests = []
  vi.stubGlobal(
    'fetch',
    vi.fn((path: string) => {
      requests.push(path)
      const next = answers.length > 1 ? answers.shift() : answers[0]
      return Promise.resolve(json(next ?? []))
    }),
  )
}

/** What the screen under the Sheet owns: the draft, the Sheet while its entry exists, and the
 * stand-in for the Create customer sheet at level 2. */
function Parent({ recent }: { recent: Recent }) {
  const draft = useSaleDraft({ today: '2026-10-02' })
  const [recentNow, setRecent] = useState(recent)
  const first = useSheet(1)
  const second = useSheet(2)
  return (
    <section>
      <h1>The sale</h1>
      <p>{`Customer id: ${draft.state.customerId ?? 'none'}`}</p>
      <p>{`Lines: ${draft.state.lines.length}`}</p>
      <button type="button" onClick={() => draft.addProduct(9)}>
        Add a line
      </button>
      <button type="button" onClick={() => setRecent({ status: 'ready', ids: recentNow.ids })}>
        Recent ready
      </button>
      <button type="button" onClick={first.open}>
        Open the search
      </button>
      {first.isOpen && (
        <CustomerSearchSheet
          recent={recentNow}
          onChoose={(chosen) => {
            draft.chooseCustomer(chosen.id)
            first.closeAll()
          }}
          onContinueWithout={() => {
            calls.withoutCustomer += 1
          }}
          onCreate={(query) => {
            calls.created.push(query)
            second.open()
          }}
        />
      )}
      {second.isOpen && (
        <section aria-label="Stand-in create sheet">
          <button type="button" onClick={second.close}>
            Back from stand-in
          </button>
        </section>
      )}
    </section>
  )
}

function renderParent(recent: Recent = { status: 'ready', ids: [] }) {
  const router = createMemoryRouter(
    [
      {
        path: '/',
        element: (
          <SheetStackProvider>
            <Parent recent={recent} />
          </SheetStackProvider>
        ),
      },
      { path: '/afuera', element: <h1>Before the sale</h1> },
    ],
    { initialEntries: ['/afuera', '/'], initialIndex: 1 },
  )
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <SheetRouterProvider router={router}>
        <RouterProvider router={router} />
      </SheetRouterProvider>
    </QueryClientProvider>,
  )
  return { router, client, user: userEvent.setup() }
}

beforeEach(() => {
  calls.created = []
  calls.withoutCustomer = 0
})
afterEach(() => vi.unstubAllGlobals())

async function openSearch(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await user.click(screen.getByRole('button', { name: 'Open the search' }))
  await screen.findByRole('dialog', { name: 'Choose a customer' })
}

test('choosing a recent customer sets the draft customer and closes the Sheet', async () => {
  stubCustomers(ALL)
  const { user } = renderParent({ status: 'ready', ids: [3, 1] })
  await openSearch(user)

  await user.click(await screen.findByRole('button', { name: /^Luis Ramos/ }))

  expect(screen.getByText('Customer id: 3')).toBeInTheDocument()
  expect(screen.queryByRole('dialog', { name: 'Choose a customer' })).not.toBeInTheDocument()
})
