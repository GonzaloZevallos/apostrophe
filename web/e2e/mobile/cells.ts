/** The cell matrix of the phone check: four sizes by two themes, and a context for each. */

import type { Browser, BrowserContext } from '@playwright/test'
import { mobileBaseUrl } from '../env.js'
import { withToastRecorder } from '../fixtures.js'
import { installToolkit } from './toolkit.js'
import { SIZES, THEMES, type Size, type Theme } from '../../src/mobile-standard/violation.ts'

export { SIZES, THEMES }
export type { Size, Theme }

/** 2026-09-16 12:00 Argentina time, the instant the server's clock is pinned to. */
export const PINNED_INSTANT = new Date('2026-09-16T15:00:00Z')

export function viewportOf(size: Size): { width: number; height: number } {
  const [width, height] = size.split('x').map(Number)
  if (width === undefined || height === undefined) throw new Error(`bad size ${size}`)
  return { width, height }
}

/**
 * A phone context at `size`, with the front's clock fixed to the server's instant and the
 * theme chosen only by an init script setting `tema=oscuro` (never an emulated system
 * theme). `storageState` is the seeded session, or an empty one for a signed-out screen.
 */
export async function newCell(
  browser: Browser,
  size: Size,
  theme: Theme,
  storageState: string | { cookies: []; origins: [] },
): Promise<BrowserContext> {
  const context = await withToastRecorder(browser.newContext({
    baseURL: mobileBaseUrl(),
    viewport: viewportOf(size),
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
    storageState,
  }))
  await context.clock.setFixedTime(PINNED_INSTANT)
  await context.addInitScript(installToolkit)
  if (theme === 'oscuro') {
    await context.addInitScript(() => {
      localStorage.setItem('tema', 'oscuro')
    })
  }
  return context
}
