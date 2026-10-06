import { paths } from '../src/routes/paths.js'
/**
 * Pins the theme rule end to end (plan, subtask `light-by-default`, seam 2; PRD
 * metrics for criteria 1 and 2): the app opens light whatever the operating
 * system says, and dark only when `<html>` carries `data-tema="oscuro"` — the
 * system's own color scheme never picks it, tested here with the opposite one
 * set each time so the attribute, not the emulated system, decides.
 *
 * `watchConsole` (CODING_STANDARDS §9, in the browser too) is attached before
 * every `goto` and the sink asserted empty at the end, as every e2e spec does.
 */

import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'
import { watchConsole } from './console.js'

const PAPEL = 'rgb(252, 251, 248)'
const PAPEL_OSCURO = 'rgb(16, 19, 26)'

async function htmlBackground(page: Page): Promise<string> {
  return page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor)
}

test('a dark system alone never gives the dark theme', async ({ page }) => {
  const messages: string[] = []
  watchConsole(page, messages)

  await page.emulateMedia({ colorScheme: 'dark' })
  await page.goto(paths.login())

  expect(await htmlBackground(page)).toBe(PAPEL)
  expect(messages).toEqual([])
})

test('data-tema="oscuro" turns the theme dark on a light system too', async ({ page }) => {
  const messages: string[] = []
  watchConsole(page, messages)

  await page.emulateMedia({ colorScheme: 'light' })
  // `document.documentElement` is still null at the moment Playwright's
  // init script runs (proven against this build: the literal one-liner
  // throws `Cannot read properties of null`), so this waits for the parser
  // to create it before setting the attribute.
  await page.addInitScript(() => {
    const apply = () => {
      document.documentElement.dataset.tema = 'oscuro'
    }
    if (document.documentElement) apply()
    else document.addEventListener('DOMContentLoaded', apply, { once: true })
  })
  await page.goto(paths.login())

  expect(await htmlBackground(page)).toBe(PAPEL_OSCURO)
  expect(messages).toEqual([])
})
