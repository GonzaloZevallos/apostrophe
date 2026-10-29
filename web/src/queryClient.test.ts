/**
 * The seam `App.tsx` relies on: any gated query's 401 is a session boundary (plan,
 * "Session"), wired once here instead of in every screen. Exercised directly on the
 * exported singleton, the same one `App.tsx` passes to `QueryClientProvider`.
 */

import { CUSTOMERS, HOME, LOGIN } from './routes'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { ApiError } from './api/client'
import { shownLanguage } from './i18n/testing'
import { applyShownLanguage, resetToBootLanguage, setLocaleLoader } from './i18n/language'
import { loadLocale } from './i18n/resources'
import { queryClient, setCurrentPath, setNavigate } from './queryClient'

beforeEach(() => {
  queryClient.clear()
})

afterEach(() => {
  setLocaleLoader(loadLocale)
  resetToBootLanguage()
  queryClient.clear()
  setCurrentPath(HOME)
  setNavigate(() => {})
})

test('a 401 from any gated query clears the cache and sends the person to Entrar', async () => {
  const navigate = vi.fn()
  setCurrentPath(CUSTOMERS)
  setNavigate(navigate)
  queryClient.setQueryData(['me'], { businessName: 'La Huerta' })

  await expect(
    queryClient.fetchQuery({
      queryKey: ['boom-1'],
      queryFn: () => Promise.reject(new ApiError(401, 'unknown')),
      retry: false,
    }),
  ).rejects.toMatchObject({ status: 401, code: 'unknown' })

  expect(queryClient.getQueryData(['me'])).toBeUndefined()
  expect(navigate).toHaveBeenCalledWith(LOGIN)
})

test('a 401 while the current screen is public does nothing', async () => {
  const navigate = vi.fn()
  setCurrentPath(LOGIN)
  setNavigate(navigate)
  queryClient.setQueryData(['me'], { businessName: 'La Huerta' })

  await expect(
    queryClient.fetchQuery({
      queryKey: ['boom-2'],
      queryFn: () => Promise.reject(new ApiError(401, 'unknown')),
      retry: false,
    }),
  ).rejects.toMatchObject({ status: 401, code: 'unknown' })

  expect(queryClient.getQueryData(['me'])).toEqual({ businessName: 'La Huerta' })
  expect(navigate).not.toHaveBeenCalled()
})

test('a refusal that is not a 401 never triggers the session boundary', async () => {
  const navigate = vi.fn()
  setCurrentPath(CUSTOMERS)
  setNavigate(navigate)
  queryClient.setQueryData(['me'], { businessName: 'La Huerta' })

  await expect(
    queryClient.fetchQuery({
      queryKey: ['boom-3'],
      queryFn: () => Promise.reject(new ApiError(404, 'customer.not_found')),
      retry: false,
    }),
  ).rejects.toMatchObject({ status: 404, code: 'customer.not_found' })

  expect(queryClient.getQueryData(['me'])).toEqual({ businessName: 'La Huerta' })
  expect(navigate).not.toHaveBeenCalled()
})

test('a 401 from a gated mutation (a screen\'s own save or delete) is the same boundary', async () => {
  const navigate = vi.fn()
  setCurrentPath(CUSTOMERS)
  setNavigate(navigate)
  queryClient.setQueryData(['me'], { businessName: 'La Huerta' })

  await expect(
    queryClient
      .getMutationCache()
      .build(queryClient, {
        mutationFn: () => Promise.reject(new ApiError(401, 'unknown')),
      })
      .execute(undefined),
  ).rejects.toMatchObject({ status: 401, code: 'unknown' })

  expect(queryClient.getQueryData(['me'])).toBeUndefined()
  expect(navigate).toHaveBeenCalledWith(LOGIN)
})

test('a 401 from a gated query restores the boot language, never the last one shown', async () => {
  setCurrentPath(CUSTOMERS)
  setNavigate(vi.fn())
  setLocaleLoader(() => Promise.resolve({ common: { hello: 'Hallo' } }))
  await applyShownLanguage('de')
  expect(shownLanguage()).toBe('de')

  await expect(
    queryClient.fetchQuery({
      queryKey: ['boom-lang'],
      queryFn: () => Promise.reject(new ApiError(401, 'unknown')),
      retry: false,
    }),
  ).rejects.toMatchObject({ status: 401 })

  expect(shownLanguage()).toBe('en')
  expect(document.documentElement.lang).toBe('en')
})
