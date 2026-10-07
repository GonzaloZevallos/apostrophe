/**
 * `useViewport`, the one module that reads the viewport: `matchMedia` is mocked here and
 * nowhere else (the other tests mock this hook). It answers `'phone'` below 900 px and
 * `'computer'` from it, asks the very query `styles/app.css` switches the chrome on, and
 * follows the media query when it flips, without a reload.
 */

import { act, renderHook } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { COMPUTER_MIN_WIDTH, useViewport } from './useViewport'

type Listener = () => void

/** A `matchMedia` whose single query can be flipped, and which remembers who listens. */
function mockMatchMedia(initial: boolean) {
  const state = { matches: initial, queries: [] as string[], listeners: new Set<Listener>() }
  vi.stubGlobal('matchMedia', (query: string) => {
    state.queries.push(query)
    return {
      get matches() {
        return state.matches
      },
      media: query,
      addEventListener: (_type: string, listener: Listener) => state.listeners.add(listener),
      removeEventListener: (_type: string, listener: Listener) => state.listeners.delete(listener),
    } as unknown as MediaQueryList
  })
  return {
    state,
    flip(matches: boolean) {
      state.matches = matches
      act(() => {
        state.listeners.forEach((listener) => listener())
      })
    },
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

test('is the phone when the width is under the computer breakpoint', () => {
  mockMatchMedia(false)
  expect(renderHook(() => useViewport()).result.current).toBe('phone')
})

test('is the computer from the computer breakpoint up', () => {
  mockMatchMedia(true)
  expect(renderHook(() => useViewport()).result.current).toBe('computer')
})

test('asks the min-width query the stylesheet switches the chrome on', () => {
  const media = mockMatchMedia(false)
  renderHook(() => useViewport())
  expect(COMPUTER_MIN_WIDTH).toBe(900)
  expect(new Set(media.state.queries)).toEqual(new Set(['(min-width: 900px)']))
})

test('follows the media query when it flips, both ways', () => {
  const media = mockMatchMedia(false)
  const { result } = renderHook(() => useViewport())
  expect(result.current).toBe('phone')

  media.flip(true)
  expect(result.current).toBe('computer')

  media.flip(false)
  expect(result.current).toBe('phone')
})

test('stops listening when the component unmounts', () => {
  const media = mockMatchMedia(false)
  const { unmount } = renderHook(() => useViewport())
  expect(media.state.listeners.size).toBe(1)

  unmount()
  expect(media.state.listeners.size).toBe(0)
})

test('is the phone where there is no matchMedia at all', () => {
  vi.stubGlobal('matchMedia', undefined)
  expect(renderHook(() => useViewport()).result.current).toBe('phone')
})
