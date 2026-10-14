/**
 * The browser-storage check every e2e run ends with (ADR-0026; CODING_STANDARDS §9, in the
 * browser too): the device keeps exactly one thing, the theme choice. `localStorage` keys
 * are a subset of `{tema}` and `tema`, when present, is `oscuro`; `sessionStorage` is empty
 * and so is IndexedDB. Anything else — a token, a name, an amount, a second key, a stored
 * `claro` — fails.
 */

import { expect } from '../fixtures.js'
import type { Page } from '@playwright/test'

export async function expectOnlyTheThemeStored(page: Page): Promise<void> {
  const storage = await page.evaluate(async () => ({
    local: Object.fromEntries(
      Object.keys(localStorage).map((key) => [key, key === 'tema' ? localStorage.getItem(key) : null]),
    ),
    session: Object.keys(sessionStorage).length,
    databases: (await indexedDB.databases()).length,
  }))

  expect(Object.keys(storage.local).filter((key) => key !== 'tema')).toEqual([])
  if ('tema' in storage.local) expect(storage.local.tema).toBe('oscuro')
  expect(storage.session).toBe(0)
  expect(storage.databases).toBe(0)
}
