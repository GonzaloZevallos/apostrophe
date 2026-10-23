import { QueryClient, QueryObserver } from '@tanstack/react-query'
import { waitFor } from '@testing-library/react'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { invalidateResource, keys } from './keys'

function clientWithData(): QueryClient {
  const queryClient = new QueryClient()
  queryClient.setQueryData(keys.customers('ana'), [{ id: '1' }])
  queryClient.setQueryData(keys.expenses('2026-10'), { total: 0 })
  queryClient.setQueryData(keys.expenseCategories(), [])
  queryClient.setQueryData(keys.me(), { businessName: 'x' })
  queryClient.setQueryData(keys.business(), { name: 'x' })
  return queryClient
}

function isInvalidated(queryClient: QueryClient, key: readonly unknown[]): boolean {
  return queryClient.getQueryState(key)?.isInvalidated ?? false
}

describe('keys', () => {
  test('builds hierarchical keys by resource', () => {
    expect(keys.customers('ana')).toEqual(['customers', { q: 'ana' }])
    expect(keys.varieties()).toEqual(['varieties'])
    expect(keys.variety('v1')).toEqual(['varieties', 'v1'])
    expect(keys.varietyPrices('v1')).toEqual(['varieties', 'v1', 'prices'])
    expect(keys.expenseCategories()).toEqual(['expense-categories'])
  })

  test('the first-run read keys outside every resource prefix', () => {
    expect(keys.firstRun()).toEqual(['first-run'])
  })

  test('a customer\'s account and the debtors list key under "payments"', () => {
    expect(keys.customerAccount('1')).toEqual(['payments', 'account', '1'])
    expect(keys.debtors()).toEqual(['payments', 'debtors'])
  })

  test('the Registrar cobro preview keys outside the payments resource, by its inputs', () => {
    expect(keys.paymentPreview('1', '2026-10-02', 5000)).toEqual([
      'payment-form',
      'preview',
      '1',
      '2026-10-02',
      5000,
    ])
  })
})

describe('invalidateResource and the catalog', () => {
  test.each(['stock', 'varieties'] as const)('a %s write also invalidates the catalog', (resource) => {
    const queryClient = clientWithData()
    queryClient.setQueryData(keys.catalog(), { text: 'x' })

    invalidateResource(queryClient, resource)

    expect(isInvalidated(queryClient, keys.catalog())).toBe(true)
  })

  test('a catalog write does not invalidate stock or varieties', () => {
    const queryClient = clientWithData()
    queryClient.setQueryData(keys.stock(), {})
    queryClient.setQueryData(keys.varieties(), [])

    invalidateResource(queryClient, 'catalog')

    expect(isInvalidated(queryClient, keys.stock())).toBe(false)
    expect(isInvalidated(queryClient, keys.varieties())).toBe(false)
  })
})

describe('invalidateResource', () => {
  test('invalidates every query under the resource\'s own prefix', () => {
    const queryClient = clientWithData()

    invalidateResource(queryClient, 'customers')

    expect(isInvalidated(queryClient, keys.customers('ana'))).toBe(true)
  })

  test('a category write also refreshes expenses', () => {
    const queryClient = clientWithData()

    invalidateResource(queryClient, 'expenseCategories')

    expect(isInvalidated(queryClient, keys.expenseCategories())).toBe(true)
    expect(isInvalidated(queryClient, keys.expenses('2026-10'))).toBe(true)
  })

  test('a business rename also refreshes what /auth/me cached', () => {
    const queryClient = clientWithData()

    invalidateResource(queryClient, 'business')

    expect(isInvalidated(queryClient, keys.business())).toBe(true)
    expect(isInvalidated(queryClient, keys.me())).toBe(true)
  })

  test('invalidating customers never touches an unrelated resource', () => {
    const queryClient = clientWithData()

    invalidateResource(queryClient, 'customers')

    expect(isInvalidated(queryClient, keys.expenses('2026-10'))).toBe(false)
    expect(isInvalidated(queryClient, keys.me())).toBe(false)
  })

  test('a payment also refreshes the customer it belongs to and the sale it settled', () => {
    const queryClient = clientWithData()
    queryClient.setQueryData(keys.sales('2026-10-01', '2026-10-31'), [])

    invalidateResource(queryClient, 'payments')

    expect(isInvalidated(queryClient, keys.customers('ana'))).toBe(true)
    expect(isInvalidated(queryClient, keys.sales('2026-10-01', '2026-10-31'))).toBe(true)
  })

  test('a payment leaves no cached panel for the next Home mount to reuse', () => {
    const queryClient = clientWithData()
    queryClient.setQueryData(keys.panel(), { debts: { total_owed: 5000 } })

    invalidateResource(queryClient, 'payments')

    expect(queryClient.getQueryData(keys.panel())).toBeUndefined()
    expect(queryClient.getQueryState(keys.panel())).toBeUndefined()
  })

  test.each(['customers', 'sales', 'stock', 'expenses'] as const)(
    'a %s write leaves the cached panel alone',
    (resource) => {
      const queryClient = clientWithData()
      queryClient.setQueryData(keys.panel(), { debts: { total_owed: 5000 } })

      invalidateResource(queryClient, resource)

      expect(queryClient.getQueryData(keys.panel())).toEqual({ debts: { total_owed: 5000 } })
    },
  )

  test('a sale also refreshes its customer\'s balance and "Owed to you"', () => {
    const queryClient = clientWithData()
    queryClient.setQueryData(keys.debtors(), { total_owed: 0 })

    invalidateResource(queryClient, 'sales')

    expect(isInvalidated(queryClient, keys.customers('ana'))).toBe(true)
    expect(isInvalidated(queryClient, keys.debtors())).toBe(true)
  })

  test('a customer rename also refreshes "Owed to you", where it shows', () => {
    const queryClient = clientWithData()
    queryClient.setQueryData(keys.debtors(), { total_owed: 0 })

    invalidateResource(queryClient, 'customers')

    expect(isInvalidated(queryClient, keys.debtors())).toBe(true)
  })
})

describe('invalidateResource refetchType', () => {
  // `VentaDetalle` (`screens/ventas/VentaDetalle.tsx`) invalidates `'sales'` right
  // before navigating away from a sale it just deleted or undid. `keys.sale(id)`
  // shares `keys.sales(...)`'s own `'sales'` prefix, so the bare, default
  // invalidate used to refetch that very detail query — still mounted for one more
  // tick — straight into a 404 the browser logs on its own (review finding,
  // e2e-sales). `refetchType: 'none'` is the fix: these two tests pin both halves
  // of it, so a regression on either side is caught here, not only by the e2e
  // run's own console assertion.
  async function clientWithActiveObserver(): Promise<{ queryClient: QueryClient; calls: number[] }> {
    const queryClient = new QueryClient()
    const calls: number[] = []
    const queryFn = (): Promise<string> => {
      calls.push(calls.length)
      return Promise.resolve('data')
    }
    const key = keys.sale('1')
    await queryClient.fetchQuery({ queryKey: key, queryFn })
    // An observer with no unmount in sight: the same shape a mounted `useQuery`
    // leaves behind while its screen is still on screen. `staleTime: Infinity` so
    // subscribing alone never triggers a second fetch — only `invalidateQueries`
    // below does, the same way a real mutation elsewhere in the app would.
    const observer = new QueryObserver(queryClient, { queryKey: key, queryFn, staleTime: Infinity })
    observer.subscribe(() => undefined)
    return { queryClient, calls }
  }

  afterEach(() => {
    vi.useRealTimers()
  })

  test('"none" leaves a still-mounted query stale, without refetching it', async () => {
    const { queryClient, calls } = await clientWithActiveObserver()
    expect(calls).toHaveLength(1)

    // A refetch that must never happen cannot be waited for: the fake clock is advanced
    // explicitly instead, so the "nothing happened" check holds at any machine speed.
    vi.useFakeTimers({ now: new Date('2026-01-05T12:00:00Z') })
    invalidateResource(queryClient, 'sales', { refetchType: 'none' })
    await vi.advanceTimersByTimeAsync(1000)

    expect(calls).toHaveLength(1) // never refetched while still mounted.
    expect(isInvalidated(queryClient, keys.sale('1'))).toBe(true) // still marked stale.
  })

  test('without it, every other call site keeps refetching a mounted query right away', async () => {
    const { queryClient, calls } = await clientWithActiveObserver()
    expect(calls).toHaveLength(1)

    invalidateResource(queryClient, 'sales')

    await waitFor(() => expect(calls).toHaveLength(2)) // the default every other mutation still relies on.
  })
})
