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
import { invalidateResource } from '../../api/keys'
import { HOME, SALE_NEW } from '../../routes'
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
    standing: 'settled',
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
  const [chosenVip, setChosenVip] = useState('none')
  const first = useSheet(1)
  const second = useSheet(2)
  return (
    <section>
      <h1>The sale</h1>
      <p>{`Customer id: ${draft.state.customerId ?? 'none'}`}</p>
      <p>{`Lines: ${draft.state.lines.length}`}</p>
      <p>{`Chosen vip: ${chosenVip}`}</p>
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
            setChosenVip(String(chosen.vip))
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
        path: SALE_NEW,
        element: (
          <SheetStackProvider>
            <Parent recent={recent} />
          </SheetStackProvider>
        ),
      },
      { path: HOME, element: <h1>Before the sale</h1> },
    ],
    { initialEntries: [HOME, SALE_NEW], initialIndex: 1 },
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

function rowNames(): string[] {
  return screen
    .queryAllByRole('button')
    .map((button) => button.textContent ?? '')
    .filter((text) => ALL.some((each) => text.startsWith(each.name)))
}

test('a typed query without accents finds the accented name, highlighted, with the matches before Create and no heading', async () => {
  stubCustomers(ALL)
  const { user } = renderParent()
  await openSearch(user)
  await screen.findByRole('button', { name: 'Continue without a customer' })

  await user.type(screen.getByRole('searchbox', { name: 'Search customers' }), 'lucia')

  const row = await screen.findByRole('button', { name: /^Lucía Gómez/ })
  expect(within(row).getByText('Lucía', { selector: 'mark' })).toBeInTheDocument()
  expect(row).not.toHaveAttribute('aria-selected')
  expect(screen.queryByRole('heading', { name: 'Recent customers' })).not.toBeInTheDocument()
  const create = screen.getByRole('button', { name: 'Create customer lucia' })
  expect(row.compareDocumentPosition(create) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
})

test('the digits of a phone are highlighted on the grouped number as shown', async () => {
  stubCustomers(ALL)
  const { user } = renderParent()
  await openSearch(user)

  await user.type(screen.getByRole('searchbox', { name: 'Search customers' }), '2222 33')

  const row = await screen.findByRole('button', { name: /^Lucía Gómez/ })
  expect(within(row).getByText('2222-33', { selector: 'mark' })).toBeInTheDocument()
})

test('names that start with the query come before the rest', async () => {
  stubCustomers(ALL)
  const { user } = renderParent()
  await openSearch(user)

  await user.type(screen.getByRole('searchbox', { name: 'Search customers' }), 'lu')

  await screen.findByRole('button', { name: /^Lucía Gómez/ })
  expect(rowNames().map((text) => text.split(' ')[0])).toEqual(['Lucía', 'Luis', 'Zoe'])
})

test('the recent list skips an id with no customer and shows at most three rows', async () => {
  stubCustomers(ALL)
  const { user } = renderParent({ status: 'ready', ids: [99, 3, 1, 2, 4] })
  await openSearch(user)

  await screen.findByRole('heading', { name: 'Recent customers' })
  expect(rowNames().map((text) => text.split(' ')[0])).toEqual(['Luis', 'Ana', 'Lucía'])
})

test('nothing at all shows when no recent id resolves', async () => {
  stubCustomers(ALL)
  const { user } = renderParent({ status: 'ready', ids: [99] })
  await openSearch(user)

  await screen.findByRole('button', { name: 'Continue without a customer' })
  await waitFor(() => expect(requests).toHaveLength(1))
  expect(screen.queryByRole('heading', { name: 'Recent customers' })).not.toBeInTheDocument()
  expect(rowNames()).toEqual([])
})

test('recent customers wait while recent is loading and show once it is ready', async () => {
  stubCustomers(ALL)
  const { user } = renderParent({ status: 'loading', ids: [3] })
  await openSearch(user)
  await waitFor(() => expect(requests).toHaveLength(1))

  expect(screen.queryByRole('heading', { name: 'Recent customers' })).not.toBeInTheDocument()
  expect(rowNames()).toEqual([])

  await user.click(screen.getByRole('button', { name: 'Recent ready' }))
  expect(await screen.findByRole('button', { name: /^Luis Ramos/ })).toBeInTheDocument()
})

test('a query nobody matches says so after the read, with Create and No customer below and no Recent block', async () => {
  stubCustomers(ALL)
  const { user } = renderParent({ status: 'ready', ids: [3] })
  await openSearch(user)

  await user.type(screen.getByRole('searchbox', { name: 'Search customers' }), 'xyz')

  expect(await screen.findByText('No customer matches «xyz».')).toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: 'Recent customers' })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Create customer xyz' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Continue without a customer' })).toBeInTheDocument()
})

test('while the read is pending a typed query shows no rows and no no-match line, but Create and No customer', async () => {
  vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(() => undefined)))
  const { user } = renderParent({ status: 'ready', ids: [3] })
  await openSearch(user)

  await user.type(screen.getByRole('searchbox', { name: 'Search customers' }), 'lu')

  expect(screen.getByRole('button', { name: 'Create customer lu' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Continue without a customer' })).toBeInTheDocument()
  expect(screen.queryByText(/No customer matches/)).not.toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: 'Recent customers' })).not.toBeInTheDocument()
  expect(rowNames()).toEqual([])
})

test('a blank query offers no Create, and No customer raises onContinueWithout without closing', async () => {
  stubCustomers(ALL)
  const { user } = renderParent()
  await openSearch(user)
  await user.type(screen.getByRole('searchbox', { name: 'Search customers' }), '   ')

  expect(screen.queryByRole('button', { name: /^Create customer/ })).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Continue without a customer' }))

  expect(calls.withoutCustomer).toBe(1)
  expect(screen.getByRole('dialog', { name: 'Choose a customer' })).toBeInTheDocument()
})

test('Close and the system back leave the sale lines as they were', async () => {
  stubCustomers(ALL)
  const { user, router } = renderParent()
  await user.click(screen.getByRole('button', { name: 'Add a line' }))
  await openSearch(user)

  await user.click(screen.getByRole('button', { name: 'Close' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  expect(screen.getByText('Lines: 1')).toBeInTheDocument()

  await openSearch(user)
  await act(async () => {
    await router.navigate(-1)
  })
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(screen.getByText('Lines: 1')).toBeInTheDocument()
})

test('Create keeps the Sheet and its query beneath the second sheet, and a reopening starts empty', async () => {
  stubCustomers(ALL)
  const { user } = renderParent()
  await openSearch(user)
  const field = screen.getByRole('searchbox', { name: 'Search customers' })
  await user.type(field, 'zz')

  await user.click(screen.getByRole('button', { name: 'Create customer zz' }))

  expect(calls.created).toEqual(['zz'])
  expect(await screen.findByRole('region', { name: 'Stand-in create sheet' })).toBeInTheDocument()
  // jsdom does not take `inert` out of the accessibility tree, so the covered content is read from
  // its attribute: the field, Close and the rows all sit inside the one inert wrapper.
  expect(field.closest('[inert]')).not.toBeNull()
  expect(screen.getByRole('button', { name: 'Close' }).closest('[inert]')).not.toBeNull()

  await user.click(screen.getByRole('button', { name: 'Back from stand-in' }))

  await waitFor(() => expect(screen.getByRole('searchbox', { name: 'Search customers' })).toHaveFocus())
  expect(screen.getByRole('searchbox', { name: 'Search customers' })).toHaveValue('zz')
  expect(screen.getByRole('searchbox', { name: 'Search customers' }).closest('[inert]')).toBeNull()

  await user.click(screen.getByRole('button', { name: 'Close' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  await openSearch(user)
  expect(screen.getByRole('searchbox', { name: 'Search customers' })).toHaveValue('')
})

test('invalidating customers sends no request, and a reopening reads a fresh vip', async () => {
  stubCustomers([{ ...ANA, vip: false }], [{ ...ANA, vip: true }])
  const { user, client } = renderParent({ status: 'ready', ids: [1] })
  await openSearch(user)
  await screen.findByRole('button', { name: /^Ana Pérez/ })
  expect(requests).toHaveLength(1)

  await act(async () => {
    invalidateResource(client, 'customers')
  })
  expect(requests).toHaveLength(1)

  await user.click(screen.getByRole('button', { name: 'Close' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  await openSearch(user)
  await user.click(await screen.findByRole('button', { name: /^Ana Pérez/ }))

  expect(requests).toHaveLength(2)
  expect(screen.getByText('Chosen vip: true')).toBeInTheDocument()
})

test('the search field is a search input with autocomplete off and a search key that chooses nobody', async () => {
  stubCustomers(ALL)
  const { user } = renderParent({ status: 'ready', ids: [3] })
  await openSearch(user)
  const field = screen.getByRole('searchbox', { name: 'Search customers' })

  expect(field).toHaveFocus()
  expect(field).toHaveAttribute('type', 'search')
  expect(field).toHaveAttribute('autocomplete', 'off')
  expect(field).toHaveAttribute('enterkeyhint', 'search')
  expect(field).not.toHaveAttribute('inputmode')

  await screen.findByRole('button', { name: /^Luis Ramos/ })
  await user.type(field, 'lu{Enter}')

  expect(screen.getByText('Customer id: none')).toBeInTheDocument()
  expect(screen.getByRole('dialog', { name: 'Choose a customer' })).toBeInTheDocument()
})
