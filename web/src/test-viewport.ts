/**
 * The one test helper that says which viewport a screen renders in: it sets the `matchMedia`
 * `useViewport` reads (the only module that asks the browser), then renders. A test never
 * mocks `useViewport` or stubs `matchMedia` itself.
 */

import { act } from '@testing-library/react'
import { vi } from 'vitest'
import type { Viewport } from './routes'

let current: Viewport = 'phone'
const listeners = new Set<() => void>()

/** Sets the viewport `useViewport` reads. `vi.unstubAllGlobals()` undoes it. */
export function stubViewport(viewport: Viewport): void {
  current = viewport
  listeners.clear()
  vi.stubGlobal(
    'matchMedia',
    (query: string) =>
      ({
        get matches() {
          return current === 'computer'
        },
        media: query,
        addEventListener: (_type: string, listener: () => void) => listeners.add(listener),
        removeEventListener: (_type: string, listener: () => void) => listeners.delete(listener),
      }) as unknown as MediaQueryList,
  )
}

/** Turns the stubbed viewport while a screen is mounted, as a window resize across 900 px does. */
export function flipViewport(viewport: Viewport): void {
  current = viewport
  act(() => {
    for (const listener of [...listeners]) listener()
  })
}

/** Renders with the viewport set first: `renderWithViewport('computer', () => render(...))`. */
export function renderWithViewport<T>(viewport: Viewport, render: () => T): T {
  stubViewport(viewport)
  return render()
}
