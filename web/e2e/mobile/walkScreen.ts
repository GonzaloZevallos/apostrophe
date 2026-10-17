/**
 * One visit of one screen in one cell, loaded or with the API held. It returns the
 * `Violation`s found and never throws for what it cannot reach: a registry step whose text
 * is missing, or a signed-in screen the app bounces to Entrar, is recorded as `unreachable`
 * with an empty target (a page rule).
 */

import type { Page } from '@playwright/test'
import type { RegistryScreen } from '../../src/mobile-standard/registry.ts'
import type { Violation } from '../../src/mobile-standard/violation.ts'
import { collect, pageViolation, type CellId } from './collect.js'
import { holdApi } from './network.js'
import { open, painted, runSteps, settle, type Facts } from './walk.js'

export async function walkScreen(
  page: Page,
  screen: RegistryScreen,
  cell: CellId,
  held: boolean,
  facts: Facts,
): Promise<Violation[]> {
  const found: Violation[] = []
  const hold = held ? await holdApi(page.context()) : null
  try {
    await open(page, screen, facts)
    if (hold !== null) {
      await painted(page)
      found.push(...(await collect(page, 'loading', cell)))
      await hold.release()
    }
    await settle(page)
    if (!screen.signedOut && new URL(page.url()).pathname.startsWith('/entrar')) {
      return [...found, pageViolation(cell, 'unreachable')]
    }
    if (hold === null) {
      if (!(await runSteps(page, screen, facts))) return [pageViolation(cell, 'unreachable')]
      found.push(...(await collect(page, 'loaded', cell)))
    }
  } finally {
    if (hold !== null) await hold.release()
  }
  return found
}
