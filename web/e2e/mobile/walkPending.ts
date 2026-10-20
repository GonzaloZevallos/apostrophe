/**
 * Taps a primary action and reads its state at once, with its write held and then
 * aborted. A form that never sends its write (a step missing, a field refused) is
 * `unreachable`, never a pass; a button that does not show a pending state is
 * `pending-state`, named by the button.
 */

import type { Page } from '@playwright/test'
import { showsPending, type PendingTap, type TappedButton } from '../../src/mobile-standard/pending.ts'
import { shorten } from '../../src/mobile-standard/targets.ts'
import type { Violation } from '../../src/mobile-standard/violation.ts'
import { pageViolation, type CellId } from './collect.js'
import { holdWrite } from './network.js'
import { open, painted, runSteps, settle, type Facts } from './walk.js'

const WRITE_WAIT_MS = 2_000

export async function walkPending(page: Page, tap: PendingTap, cell: CellId, facts: Facts): Promise<Violation[]> {
  const context = page.context()
  const hold = await holdWrite(context, tap.write.method, tap.write.path)
  try {
    const screen = { screen: tap.screen, route: tap.route, path: tap.route, viewport: null, signedOut: tap.signedOut ?? false, theme: null, steps: tap.steps }
    await open(page, screen, facts)
    await settle(page)
    if (!(await runSteps(page, screen, facts))) return [pageViolation(cell, 'unreachable')]
    const button = page.getByRole('button', { name: tap.button, exact: true }).first()
    const handle = await button.elementHandle({ timeout: 3_000 }).catch(() => null)
    if (handle === null) return [pageViolation(cell, 'unreachable')]
    const label = async (): Promise<TappedButton> =>
      handle.evaluate((element) => ({
        disabled: element instanceof HTMLButtonElement && element.disabled,
        busy: element.getAttribute('aria-busy') === 'true',
        label: (element.textContent ?? '').replace(/\s+/g, ' ').trim(),
      }))
    const before = (await label()).label
    // Without a pointer: at 320 and 246 the bar can sit over the button, which is the
    // geometry checkers' finding, not a reason for the tap to be refused here.
    await handle.dispatchEvent('click')
    if (!(await hold.whenHeld(WRITE_WAIT_MS))) return [pageViolation(cell, 'unreachable')]
    await painted(page)
    const after = await label()
    return showsPending(before, after)
      ? []
      : [{ ...cell, rule: 'pending-state', target: shorten(`button:${before}`) }]
  } finally {
    await hold.release()
  }
}
