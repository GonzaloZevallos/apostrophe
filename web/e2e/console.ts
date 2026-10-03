/**
 * The one console collector the e2e run trusts (plan, "Observability": "the e2e
 * run asserts zero console messages"). `flow.spec.ts` attaches this to every page
 * it opens and asserts the array it returns is empty at the end; `consoleCollector
 * .spec.ts` attaches the same function to its own page and proves a real message
 * lands in that same array — so a collector that is miswired or attached to the
 * wrong page fails that canary too, not only the real run (review finding, e2e:
 * a prior version of the canary built its own separate copy instead).
 */

import type { Page } from '@playwright/test'

export function watchConsole(page: Page, sink: string[]): void {
  page.on('console', (message) => sink.push(`${message.type()}: ${message.text()}`))
}
