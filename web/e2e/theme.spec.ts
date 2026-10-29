/**
 * Pins the device's theme choice (ADR-0026, amended by the owner's decision of 2026-10-29)
 * end to end. With nothing stored the theme is Automatic: it follows the phone, at load and
 * live. Light (`tema=claro`) and Dark (`tema=oscuro`) are stored on the device, survive a
 * reload and a logout, win over the phone and show on every screen before login. Any other
 * stored value reads as Automatic. The status bar (`theme-color`) follows the attribute.
 *
 * The phone is emulated with `emulateMedia`; the page's own `data-tema` is what is asserted.
 *
 * `watchConsole` (CODING_STANDARDS §9, in the browser too) is attached before
 * every `goto` and the sink asserted empty at the end, as every e2e spec does.
 */

import { LOGIN, SETTINGS_APPEARANCE } from '../src/routes.js'
import type { Page } from '@playwright/test'
import { expect, test } from './fixtures.js'
import { newBusinessInvitationUrl, resetLink } from './backend.js'
import { signUpNewBusiness } from './helpers/signup.js'
import { watchConsole } from './console.js'
import { expectOnlyTheThemeStored } from './helpers/storage.js'
import { uniqueTag } from './helpers/unique.js'

const PAPEL = 'rgb(246, 247, 245)'
const PAPEL_OSCURO = 'rgb(14, 20, 17)'
const PAPEL_HEX = '#f6f7f5'

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

test('a dark phone with nothing stored opens dark, and the status bar takes the dark paper', async ({
  page,
}) => {
  const messages: string[] = []
  watchConsole(page, messages)

  await page.emulateMedia({ colorScheme: 'dark' })
  await page.goto(LOGIN)
  await page.waitForLoadState('load')

  expect(await themeAttribute(page)).toBe('oscuro')
  expect(await htmlBackground(page)).toBe(PAPEL_OSCURO)
  const dark = (await computedPapel(page)).toLowerCase()
  expect(dark).not.toBe(PAPEL_HEX)
  await expect.poll(async () => (await themeColor(page))?.toLowerCase()).toBe(dark)
  expect(await page.evaluate(() => localStorage.getItem('tema'))).toBeNull()
  expect(messages).toEqual([])
})

test('on Automatic, a flip of the phone changes the theme live and the status bar follows it', async ({
  page,
}) => {
  const messages: string[] = []
  watchConsole(page, messages)

  await page.emulateMedia({ colorScheme: 'dark' })
  await page.goto(LOGIN)
  await page.waitForLoadState('load')
  expect(await themeAttribute(page)).toBe('oscuro')

  await page.emulateMedia({ colorScheme: 'light' })
  await expect.poll(() => themeAttribute(page)).toBeNull()
  await expect.poll(async () => (await themeColor(page))?.toLowerCase()).toBe(PAPEL_HEX)

  await page.emulateMedia({ colorScheme: 'dark' })
  await expect.poll(() => themeAttribute(page)).toBe('oscuro')
  expect(messages).toEqual([])
})

test('a light phone with nothing stored opens light', async ({ page }) => {
  const messages: string[] = []
  watchConsole(page, messages)

  await page.emulateMedia({ colorScheme: 'light' })
  await page.goto(LOGIN)

  expect(await themeAttribute(page)).toBeNull()
  expect(await htmlBackground(page)).toBe(PAPEL)
  expect(messages).toEqual([])
})

test('tema=oscuro opens dark on a light phone', async ({ page }) => {
  const messages: string[] = []
  watchConsole(page, messages)

  await page.emulateMedia({ colorScheme: 'light' })
  await page.addInitScript(() => {
    localStorage.setItem('tema', 'oscuro')
  })
  await page.goto(LOGIN)

  expect(await themeAttribute(page)).toBe('oscuro')
  expect(await htmlBackground(page)).toBe(PAPEL_OSCURO)
  expect(messages).toEqual([])
})

test('tema=claro on a dark phone stays light after a reload, and a flip does not move it', async ({
  page,
}) => {
  const messages: string[] = []
  watchConsole(page, messages)
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.addInitScript(() => {
    localStorage.setItem('tema', 'claro')
  })

  await page.goto(LOGIN)
  expect(await themeAttribute(page)).toBeNull()
  expect(await htmlBackground(page)).toBe(PAPEL)

  await page.reload()
  expect(await themeAttribute(page)).toBeNull()
  expect(await htmlBackground(page)).toBe(PAPEL)

  await page.emulateMedia({ colorScheme: 'light' })
  await page.emulateMedia({ colorScheme: 'dark' })
  expect(await themeAttribute(page)).toBeNull()
  expect(await page.evaluate(() => localStorage.getItem('tema'))).toBe('claro')
  expect(messages).toEqual([])
})

test('a stored value that is neither claro nor oscuro reads as Automatic and is left alone', async ({
  page,
}) => {
  const messages: string[] = []
  watchConsole(page, messages)
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.addInitScript(() => {
    localStorage.setItem('tema', 'otro')
  })

  await page.goto(LOGIN)

  expect(await themeAttribute(page)).toBe('oscuro')
  expect(await page.evaluate(() => localStorage.getItem('tema'))).toBe('otro')
  expect(messages).toEqual([])
})

const PASSWORD = 'correcthorsebattery'

async function signUp(page: Page): Promise<string> {
  const email = `tema-${uniqueTag()}@example.com`
  await signUpNewBusiness(page, { businessName: `Tema ${uniqueTag()}`, email })
  return email
}

/**
 * Signs up and stays in the Onboarding, then waits until the page has stopped reading.
 * The accept leads to a chain of reads, each started after the one before has answered:
 * `/auth/me`, `/onboarding-progress`, then `/pricing-settings`. The last one's 200 proves
 * the chain is done (the name field is drawn while it is still in flight, so it proves
 * nothing). Leaving for `about:blank` then means no app page is mounted — and so none can
 * read again on focus or reconnect — when the cookie drops: a read answered 401 after
 * `logOut` would put a `Failed to load resource` entry in the console sink.
 */
async function signUpAndSettleInOnboarding(page: Page): Promise<string> {
  const settled = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === '/pricing-settings' &&
      response.request().method() === 'GET',
  )
  const { email } = await signUpNewBusiness(page, {
    businessName: `Tema ${uniqueTag()}`,
    email: `tema-${uniqueTag()}@example.com`,
    stayInOnboarding: true,
  })
  const response = await settled
  expect(response.status()).toBe(200)
  await page.goto('about:blank')
  return email
}

async function logOut(page: Page): Promise<void> {
  // The seam under test is the theme, not the logout control (Tu cuenta has its own run):
  // the cookie lives in the page's context, so this signs the same device out.
  const response = await page.context().request.post('/auth/logout')
  expect(response.status()).toBe(204)
}

async function themeAttribute(page: Page): Promise<string | null> {
  return page.evaluate(() => document.documentElement.getAttribute('data-tema'))
}

test('choosing Dark in Apariencia applies it, survives a reload and a logout, Light stays light on a dark phone, and Automatic follows the phone again', async ({
  page,
}) => {
  const messages: string[] = []
  watchConsole(page, messages)
  await page.emulateMedia({ colorScheme: 'light' })

  const email = await signUp(page)
  await page.goto(SETTINGS_APPEARANCE)
  await expect(page.getByRole('radio', { name: 'Automatic' })).toHaveAttribute('aria-checked', 'true')

  await page.getByRole('radio', { name: 'Dark' }).click()
  expect(await themeAttribute(page)).toBe('oscuro')
  expect(await htmlBackground(page)).toBe(PAPEL_OSCURO)
  expect(await page.evaluate(() => localStorage.getItem('tema'))).toBe('oscuro')
  await expect(page.getByRole('radio', { name: 'Dark' })).toHaveAttribute('aria-checked', 'true')

  await page.reload()
  expect(await themeAttribute(page)).toBe('oscuro')
  await expect(page.getByRole('radio', { name: 'Dark' })).toHaveAttribute('aria-checked', 'true')

  await logOut(page)
  await page.goto(LOGIN)
  expect(await themeAttribute(page)).toBe('oscuro')
  expect(await htmlBackground(page)).toBe(PAPEL_OSCURO)
  await expectOnlyTheThemeStored(page)

  // Signed in again, Light wins over a dark phone, and survives a reload.
  await page.getByLabel('Email address').fill(email)
  await page.getByLabel('Password').fill(PASSWORD)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.locator('.encabezado__negocio')).toBeVisible()
  expect(await themeAttribute(page)).toBe('oscuro')
  await page.goto(SETTINGS_APPEARANCE)
  await page.getByRole('radio', { name: 'Light' }).click()
  await page.emulateMedia({ colorScheme: 'dark' })
  expect(await themeAttribute(page)).toBeNull()
  expect(await page.evaluate(() => localStorage.getItem('tema'))).toBe('claro')
  expect(await htmlBackground(page)).toBe(PAPEL)
  await page.reload()
  expect(await themeAttribute(page)).toBeNull()
  await expect(page.getByRole('radio', { name: 'Light' })).toHaveAttribute('aria-checked', 'true')
  await expectOnlyTheThemeStored(page)

  // Automatic forgets the choice and follows the dark phone at once.
  await page.getByRole('radio', { name: 'Automatic' }).click()
  expect(await page.evaluate(() => localStorage.getItem('tema'))).toBeNull()
  await expect.poll(() => themeAttribute(page)).toBe('oscuro')
  await page.reload()
  expect(await themeAttribute(page)).toBe('oscuro')
  await expect(page.getByRole('radio', { name: 'Automatic' })).toHaveAttribute('aria-checked', 'true')
  await expectOnlyTheThemeStored(page)

  expect(messages).toEqual([])
})

test('with Oscuro stored, Entrar, the invitation screen and the reset screen are dark', async ({
  page,
}) => {
  const messages: string[] = []
  watchConsole(page, messages)
  await page.emulateMedia({ colorScheme: 'light' })
  await page.addInitScript(() => {
    try {
      localStorage.setItem('tema', 'oscuro')
    } catch {
      // `about:blank` has an opaque origin and no storage: the write only matters on the app's.
    }
  })

  const email = await signUpAndSettleInOnboarding(page)
  await logOut(page)

  await page.goto(LOGIN)
  await expect(page.getByLabel('Email address')).toBeVisible()
  expect(await htmlBackground(page)).toBe(PAPEL_OSCURO)

  await page.goto(newBusinessInvitationUrl())
  await expect(page.getByLabel('Business name')).toBeVisible()
  expect(await themeAttribute(page)).toBe('oscuro')
  expect(await htmlBackground(page)).toBe(PAPEL_OSCURO)

  await page.goto(resetLink(email))
  await expect(page.getByLabel('New password')).toBeVisible()
  expect(await themeAttribute(page)).toBe('oscuro')
  expect(await htmlBackground(page)).toBe(PAPEL_OSCURO)

  expect(messages).toEqual([])
})

test('the storage helper rejects an unknown tema value, a second key, session storage and an IndexedDB database', async ({ page }) => {
  await page.goto(LOGIN)
  await expectOnlyTheThemeStored(page)

  await page.evaluate(() => localStorage.setItem('tema', 'otro'))
  await expect(expectOnlyTheThemeStored(page)).rejects.toThrow()
  await page.evaluate(() => localStorage.removeItem('tema'))

  await page.evaluate(() => localStorage.setItem('cliente', 'Ana'))
  await expect(expectOnlyTheThemeStored(page)).rejects.toThrow()
  await page.evaluate(() => localStorage.removeItem('cliente'))

  await page.evaluate(() => sessionStorage.setItem('x', '1'))
  await expect(expectOnlyTheThemeStored(page)).rejects.toThrow()
  await page.evaluate(() => sessionStorage.clear())

  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('intruso')
        open.onsuccess = () => {
          open.result.close()
          resolve()
        }
        open.onerror = () => reject(new Error('indexedDB.open failed'))
      }),
  )
  await expect(expectOnlyTheThemeStored(page)).rejects.toThrow()
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const drop = indexedDB.deleteDatabase('intruso')
        drop.onsuccess = () => resolve()
        drop.onerror = () => reject(new Error('indexedDB.deleteDatabase failed'))
      }),
  )

  await page.evaluate(() => localStorage.setItem('tema', 'oscuro'))
  await expectOnlyTheThemeStored(page)
  await page.evaluate(() => localStorage.setItem('tema', 'claro'))
  await expectOnlyTheThemeStored(page)
})
