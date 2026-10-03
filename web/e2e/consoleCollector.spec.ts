/**
 * Proves the collector `flow.spec.ts` trusts for its zero-console assertion
 * (plan, "Observability": "the e2e run asserts zero console messages") actually
 * records a message, on a page the real backend serves — not only on the input it
 * must accept (an app that never logs anything), which `flow.spec.ts` alone cannot
 * tell apart from a miswired or disconnected collector (review finding, e2e).
 */

import { expect, test } from '@playwright/test'

test('the console collector records a message it must later reject', async ({ page }) => {
  const consoleMessages: string[] = []
  page.on('console', (message) => consoleMessages.push(`${message.type()}: ${message.text()}`))

  await page.goto('/entrar')
  await page.evaluate(() => {
    console.log('e2e-canary')
  })

  await expect.poll(() => consoleMessages).toContain('log: e2e-canary')
})
