/**
 * The one test helper that says which viewport a screen renders in: it sets the `matchMedia`
 * `useViewport` reads (the only module that asks the browser), then renders. A test never
 * mocks `useViewport` or stubs `matchMedia` itself.
 */

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
