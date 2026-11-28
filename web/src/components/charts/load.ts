/**
 * The only `import()` of `ChartsImpl.tsx`, so Recharts stays out of the main bundle. A phone
 * preloads the chunk once the app is up; a screen that draws a chart loads it on demand.
 */

import { useEffect } from 'react'
import { useViewport } from '../../shell/useViewport'

/** One shared import: concurrent callers wait on the same promise, and a failure is not remembered. */
export function createLoader<T>(importer: () => Promise<T>): { load: () => Promise<T>; preload: () => void } {
  let pending: Promise<T> | null = null
  const load = (): Promise<T> => {
    if (pending === null) {
      pending = importer().catch((error: unknown) => {
        pending = null
        throw error
      })
    }
    return pending
  }
  const preload = (): void => {
    load().catch(() => undefined)
  }
  return { load, preload }
}

const charts = createLoader(() => import('./ChartsImpl.tsx'))

export const loadCharts = charts.load
export const preloadCharts = charts.preload

/** On a phone, starts fetching the chart chunk; the shared promise makes it once per page load. */
export function usePreloadCharts(): void {
  const viewport = useViewport()
  useEffect(() => {
    if (viewport === 'phone') preloadCharts()
  }, [viewport])
}
