/**
 * Collector plumbing: a collector is a function run inside the page by `page.evaluate`
 * that returns the `Violation`s it finds (it is handed the cell's identity and fills it
 * in; a checker only returns Violations, `diffOffenders` alone decides whether one is
 * allowed). The geometry, colour and loading checkers register here; the harness ships
 * with none, so a cell fails today only on a screen it could not reach.
 */

import type { Page } from '@playwright/test'
import type { Rule, Violation } from '../../src/mobile-standard/violation.ts'

export interface CellId {
  screen: string
  size: Violation['size']
  theme: Violation['theme']
}

/** What runs in the page: no Node, no closure over this file. */
export type PageCollector = (cell: CellId) => Violation[]

export interface Collector {
  name: string
  /** `loaded`: after the data arrived. `loading`: while the API is held. */
  phase: 'loaded' | 'loading'
  run: PageCollector
}

/** The registered collectors; later subtasks append, one per line. */
export const COLLECTORS: readonly Collector[] = []

export async function collect(
  page: Page,
  phase: Collector['phase'],
  cell: CellId,
  collectors: readonly Collector[] = COLLECTORS,
): Promise<Violation[]> {
  const found: Violation[] = []
  for (const collector of collectors.filter((c) => c.phase === phase)) {
    found.push(...(await page.evaluate(collector.run, cell)))
  }
  return found
}

export function pageViolation(cell: CellId, rule: Rule): Violation {
  return { ...cell, rule, target: '' }
}
