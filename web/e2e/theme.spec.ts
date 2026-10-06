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

async function themeColor(page: Page): Promise<string | null> {
  return page.evaluate(
    () => document.querySelector('meta[name="theme-color"]')?.getAttribute('content') ?? null,
  )
}

async function computedPapel(page: Page): Promise<string> {
  return page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--papel').trim(),
  )
}

async function htmlBackground(page: Page): Promise<string> {
  return page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor)
}

test('a dark system alone never gives the dark theme', async ({ page }) => {
  const messages: string[] = []
  watchConsole(page, messages)

  await page.emulateMedia({ colorScheme: 'dark' })
  await page.goto('/entrar')

  expect(await htmlBackground(page)).toBe(PAPEL)
  expect(messages).toEqual([])
})

test('the status bar follows data-tema alone: light by default, dark with the attribute, light again without', async ({
  page,
}) => {
  const messages: string[] = []
  watchConsole(page, messages)

  // The system is dark and no attribute is set: the meta must stay the light paper.
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.goto('/entrar')
  await page.waitForLoadState('load')
  const light = await computedPapel(page)
  expect(light).not.toBe('')
  expect(await themeColor(page)).toBe(light)

  await page.evaluate(() => {
    document.documentElement.dataset.tema = 'oscuro'
  })
  await expect.poll(() => themeColor(page)).not.toBe(light)
  const dark = await computedPapel(page)
  expect(dark).not.toBe(light)
  expect(await themeColor(page)).toBe(dark)

  await page.evaluate(() => {
    document.documentElement.removeAttribute('data-tema')
  })
  await expect.poll(() => themeColor(page)).toBe(light)
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
  await page.goto('/entrar')

  expect(await htmlBackground(page)).toBe(PAPEL_OSCURO)
  expect(messages).toEqual([])
})
