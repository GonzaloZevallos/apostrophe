/**
 * One visit of one screen in one cell, loaded or with the API held. It returns the
 * `Violation`s found and never throws for what it cannot reach: a registry step whose text
 * is missing, or a signed-in screen the app bounces to Entrar, is recorded as `unreachable`
 * with an empty target (a page rule).
 */

import { LOGIN } from '../../src/routes.ts'
import type { Page } from '@playwright/test'
import type { WalkState } from '../../src/mobile-standard/states.ts'
import type { Violation } from '../../src/mobile-standard/violation.ts'
import { collect, pageViolation, type CellId } from './collect.js'
import { guardWrites, holdApi, stubReads } from './network.js'
import { asScreen } from './states.js'
import { open, painted, runSteps, settle, type Facts, type WalkScreen } from './walk.js'

/** How long a held screen has to ask for its data before it counts as asking for none. */
const FETCH_WAIT_MS = 300

export async function walkScreen(
  page: Page,
  screen: WalkScreen,
  cell: CellId,
  held: boolean,
  facts: Facts,
): Promise<Violation[]> {
  const found: Violation[] = []
  const hold = held ? await holdApi(page.context()) : null
  try {
    await open(page, screen, facts)
    // A screen that asks for nothing has no loading state to read.
    let fetched = false
    if (hold !== null) {
      await painted(page)
      fetched = await hold.whenHeld(FETCH_WAIT_MS)
      if (fetched) found.push(...(await collect(page, 'loading', cell)))
      await page.evaluate(() => {
        if (window.__phone !== undefined) window.__phone.releasedAt = performance.now()
      })
      await hold.release()
    }
    await settle(page)
    if (!screen.signedOut && new URL(page.url()).pathname.startsWith(LOGIN)) {
      return [...found, pageViolation(cell, 'unreachable')]
    }
    if (hold !== null && fetched) found.push(...(await collect(page, 'released', cell)))
    if (hold === null) {
      if (!(await runSteps(page, screen, facts))) return [pageViolation(cell, 'unreachable')]
      found.push(...(await collect(page, 'loaded', cell)))
    }
  } finally {
    if (hold !== null) await hold.release()
  }
  return found
}

/**
 * Visits one state loaded, with the answers it is given in place of the backend's: its
 * stubbed writes (every other write is still aborted) and its stubbed GETs, taken off
 * again when the visit ends so the next screen sees the real server.
 */
export async function walkState(
  page: Page,
  state: WalkState,
  cell: CellId,
  facts: Facts,
): Promise<Violation[]> {
  const context = page.context()
  const undoWrites = await guardWrites(context, state.writes ?? [])
  const undoReads = await stubReads(context, state.reads ?? [])
  try {
    return await walkScreen(page, asScreen(state), cell, false, facts)
  } finally {
    await undoReads()
    await undoWrites()
  }
}
