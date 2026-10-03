import { QueryClient } from '@tanstack/react-query'
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
