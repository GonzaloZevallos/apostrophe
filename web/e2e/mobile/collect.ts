/**
 * Collector plumbing: a collector is a function run inside the page by `page.evaluate`
 * that returns the `Violation`s it finds (it is handed the cell's identity and fills it
 * in; a checker only returns Violations, `diffOffenders` alone decides whether one is
 * allowed). The geometry, colour and loading checkers register here.
 */

import type { Page } from '@playwright/test'
import type { CellId } from '../../src/mobile-standard/targets.ts'
import type { Rule, Violation } from '../../src/mobile-standard/violation.ts'
import { collectGeometry } from './collectGeometry.js'
import { COLOUR_COLLECTOR } from './collectColour.js'
import { LOADING_COLLECTOR, SHIFT_COLLECTOR } from './collectLoading.js'

export type { CellId }

/**
 * A collector reads the page (what runs in it is self-contained: no Node, no closure) and
 * returns the Violations it finds; this side may judge what the page reported.
 */
export interface Collector {
  name: string
  /**
   * `loaded`: after the data arrived. `loading`: while the API is held. `released`: after
   * the held answers came, when what moved is known.
   */
  phase: 'loaded' | 'loading' | 'released'
  run: (page: Page, cell: CellId) => Promise<Violation[]>
}

/** The registered collectors; later subtasks append, one per line. */
export const GEOMETRY_COLLECTOR: Collector = {
  name: 'geometry',
  phase: 'loaded',
  run: (page, cell) => page.evaluate(collectGeometry, cell),
}

export const COLLECTORS: readonly Collector[] = [
  GEOMETRY_COLLECTOR,
  COLOUR_COLLECTOR,
  LOADING_COLLECTOR,
  SHIFT_COLLECTOR,
]

/** Quiet window the page must hold, with no DOM change, before the loaded screen is measured. */
export const QUIET_MS = 400
const QUIET_CAP_MS = 8_000

/**
 * Waits until the page has stopped changing: a screen's data arrives after the network
 * looks idle, and a measure taken on the skeleton would be a different screen's failure.
 * Gives up at a cap rather than hang on a page that never stops moving.
 */
export async function quiet(page: Page): Promise<void> {
  await page.evaluate(
    ([window, cap]) =>
      new Promise<void>((done) => {
        let timer = setTimeout(finish, window)
        const cut = setTimeout(finish, cap)
        const watch = new MutationObserver(() => {
          clearTimeout(timer)
          timer = setTimeout(finish, window)
        })
        watch.observe(document.documentElement, { subtree: true, childList: true, characterData: true, attributes: true })
        function finish(): void {
          watch.disconnect()
          clearTimeout(timer)
          clearTimeout(cut)
          done()
        }
      }),
    [QUIET_MS, QUIET_CAP_MS] as const,
  )
}

export async function collect(
  page: Page,
  phase: Collector['phase'],
  cell: CellId,
  collectors: readonly Collector[] = COLLECTORS,
): Promise<Violation[]> {
  const found: Violation[] = []
  if (phase !== 'loading') await quiet(page)
  for (const collector of collectors.filter((c) => c.phase === phase)) {
    found.push(...(await collector.run(page, cell)))
  }
  return found
}

export function pageViolation(cell: CellId, rule: Rule): Violation {
  return { ...cell, rule, target: '' }
}
