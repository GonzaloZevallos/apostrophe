/**
 * `CustomersBehind` at the component seam: Testing Library, `fetch` faked. It reads the debtors
 * answer only through `useDebtors`, so a failed read, with or without older figures, draws the flat
 * list with no segment, count, Total owed, bar or "Nobody owes you", and never the retry notice.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { keys } from '../../api/keys'
import { MoneyFormatProvider } from '../../format/MoneyFormatProvider'
import { baselineText } from '../../i18n/testing'
import { debtorsOf } from '../../test/debtors'
import CustomersBehind from './CustomersBehind'
import { CustomerSearchContext } from './CustomerSearch'

const NOBODY_OWES = baselineText('customers.ts:NOBODY_OWES')
const LU = { id: 2, name: 'Lu', phone: '+5491100000002', phone_display: '+54 9 11 0000-0002', vip: false, balance: 0, owing_since: null, standing: 'settled' }

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

function stub(debtors: () => Response) {
  vi.mocked(fetch).mockImplementation((input) => {
    const url = typeof input === 'string' ? input : input.toString()
    return Promise.resolve(url === '/payments/debtors' ? debtors() : jsonResponse(200, [LU]))
  })
}

function renderBehind() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <MoneyFormatProvider format={{ symbol: '$', decimals: 0 }}>
        <MemoryRouter>
          <CustomerSearchContext.Provider
            value={{ query: '', setQuery: () => {}, segment: 'owed', setSegment: () => {} }}
          >
            <CustomersBehind />
          </CustomerSearchContext.Provider>
        </MemoryRouter>
      </MoneyFormatProvider>
    </QueryClientProvider>,
  )
  return queryClient
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
})

afterEach(() => {
  vi.unstubAllGlobals()
})

test('a failed debtors read shows the flat list with no figures and no notice', async () => {
  stub(() => new Response('boom', { status: 500 }))
  renderBehind()

  expect(await screen.findByText('Lu')).toBeInTheDocument()
  expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument()
  expect(screen.queryByText(NOBODY_OWES)).not.toBeInTheDocument()
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
  expect(screen.queryByRole('button')).not.toBeInTheDocument()
})

test('figures shown and then a newer failed read drop to the flat list with none of them', async () => {
  let failing = false
  stub(() => (failing ? new Response('boom', { status: 500 }) : jsonResponse(200, debtorsOf())))
  const queryClient = renderBehind()
  expect(await screen.findByRole('radiogroup')).toBeInTheDocument()

  failing = true
  await act(() => queryClient.invalidateQueries({ queryKey: keys.debtors() }))

  await waitFor(() => expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument())
  expect(screen.getByText('Lu')).toBeInTheDocument()
  expect(screen.queryByText(`$ ${debtorsOf().total_owed.toLocaleString('es-AR')}`)).not.toBeInTheDocument()
})
