/**
 * Proves `watchConsole` — the collector `flow.spec.ts` attaches to both `page` and
 * `partnerPage` and asserts empty at the end (plan, "Observability") — actually
 * records a message, on a page the real backend serves. Runs the exact same
 * function `flow.spec.ts` imports, not a separate copy: a miswired `watchConsole`
 * (attached to the wrong page, or never called) now fails this canary too, which
 * `flow.spec.ts` alone cannot tell apart from an app that simply never logs
 * anything (review finding, e2e).
 */

import { expect, test } from '@playwright/test'
import { watchConsole } from './console.js'

test('the shared console collector records a message it must later reject', async ({ page }) => {
  const consoleMessages: string[] = []
  watchConsole(page, consoleMessages)

  await page.goto('/entrar')
  await page.evaluate(() => {
    console.log('e2e-canary')
  })

  await expect.poll(() => consoleMessages).toContain('log: e2e-canary')
})
