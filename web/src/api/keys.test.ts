import { QueryClient, QueryObserver } from '@tanstack/react-query'
import { describe, expect, test } from 'vitest'
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
      calls.push(Date.now())
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

  test('"none" leaves a still-mounted query stale, without refetching it', async () => {
    const { queryClient, calls } = await clientWithActiveObserver()
    expect(calls).toHaveLength(1)

    invalidateResource(queryClient, 'sales', { refetchType: 'none' })
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(calls).toHaveLength(1) // never refetched while still mounted.
    expect(isInvalidated(queryClient, keys.sale('1'))).toBe(true) // still marked stale.
  })

  test('without it, every other call site keeps refetching a mounted query right away', async () => {
    const { queryClient, calls } = await clientWithActiveObserver()
    expect(calls).toHaveLength(1)

    invalidateResource(queryClient, 'sales')
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(calls).toHaveLength(2) // the default every other mutation still relies on.
  })
})
