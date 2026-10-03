import { act, renderHook } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { useOnline } from './useOnline'

afterEach(() => {
  vi.unstubAllGlobals()
})

test('starts from navigator.onLine', () => {
  vi.stubGlobal('navigator', { onLine: false })

  const { result } = renderHook(() => useOnline())

  expect(result.current).toBe(false)
})

test('flips when the browser fires offline, then online', () => {
  vi.stubGlobal('navigator', { onLine: true })
  const { result } = renderHook(() => useOnline())
  expect(result.current).toBe(true)

  act(() => {
    window.dispatchEvent(new Event('offline'))
  })
  expect(result.current).toBe(false)

  act(() => {
    window.dispatchEvent(new Event('online'))
  })
  expect(result.current).toBe(true)
})
