/**
 * The one test helper that says which viewport a screen renders in: it sets the `matchMedia`
 * `useViewport` reads (the only module that asks the browser), then renders. A test never
 * mocks `useViewport` or stubs `matchMedia` itself.
 */

import { act } from '@testing-library/react'
import { vi } from 'vitest'
import type { Viewport } from './routes'

/** Sets the viewport `useViewport` reads. `vi.unstubAllGlobals()` undoes it. */
export function stubViewport(viewport: Viewport): void {
  const matches = viewport === 'computer'
  vi.stubGlobal(
    'matchMedia',
    (query: string) =>
      ({
        matches,
        media: query,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      }) as unknown as MediaQueryList,
  )
}

/** Renders with the viewport set first: `renderWithViewport('computer', () => render(...))`. */
export function renderWithViewport<T>(viewport: Viewport, render: () => T): T {
  stubViewport(viewport)
  return render()
}

/** Like `stubViewport`, but the viewport can cross the breakpoint later: `set` tells whoever listens. */
export function stubMovableViewport(initial: Viewport): { set: (viewport: Viewport) => void } {
  let matches = initial === 'computer'
  const listeners = new Set<() => void>()
  vi.stubGlobal(
    'matchMedia',
    (query: string) =>
      ({
        get matches() {
          return matches
        },
        media: query,
        addEventListener: (_type: string, listener: () => void) => listeners.add(listener),
        removeEventListener: (_type: string, listener: () => void) => listeners.delete(listener),
      }) as unknown as MediaQueryList,
  )
  return {
    set(viewport) {
      matches = viewport === 'computer'
      act(() => {
        listeners.forEach((listener) => listener())
      })
    },
  }
}
