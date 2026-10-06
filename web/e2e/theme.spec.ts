/**
 * Pins the device's theme choice (ADR-0026) on top of the rule below: Oscuro chosen in
 * Configuración → Apariencia is remembered on the device, survives a reload and a logout,
 * and shows on every screen before login; Claro removes it; a tampered value reads as light.
 * No test here reaches dark by emulating a dark system.
 *
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
import { newBusinessInvitationUrl, resetLink } from './backend.js'
import { signUpNewBusiness } from './helpers/signup.js'
import { watchConsole } from './console.js'
import { expectOnlyTheThemeStored } from './helpers/storage.js'

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

const PASSWORD = 'correcthorsebattery'

async function signUp(page: Page): Promise<string> {
  const email = `tema-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`
  await signUpNewBusiness(page, { businessName: `Tema ${Date.now()}`, email })
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

test('choosing Oscuro in Apariencia applies it, survives a reload and a logout, and Claro removes it', async ({
  page,
}) => {
  const messages: string[] = []
  watchConsole(page, messages)
  await page.emulateMedia({ colorScheme: 'light' })

  const email = await signUp(page)
  await page.goto('/settings/appearance')
  await expect(page.getByRole('radio', { name: 'Claro' })).toHaveAttribute('aria-checked', 'true')

  await page.getByRole('radio', { name: 'Oscuro' }).click()
  expect(await themeAttribute(page)).toBe('oscuro')
  expect(await htmlBackground(page)).toBe(PAPEL_OSCURO)
  expect(await page.evaluate(() => localStorage.getItem('tema'))).toBe('oscuro')
  await expect(page.getByRole('radio', { name: 'Oscuro' })).toHaveAttribute('aria-checked', 'true')

  await page.reload()
  expect(await themeAttribute(page)).toBe('oscuro')
  await expect(page.getByRole('radio', { name: 'Oscuro' })).toHaveAttribute('aria-checked', 'true')

  await logOut(page)
  await page.goto('/entrar')
  expect(await themeAttribute(page)).toBe('oscuro')
  expect(await htmlBackground(page)).toBe(PAPEL_OSCURO)
  await expectOnlyTheThemeStored(page)

  // Signed in again, Claro removes the attribute and the key.
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Contraseña').fill(PASSWORD)
  await page.getByRole('button', { name: 'Entrá' }).click()
  await expect(page.locator('.encabezado__negocio')).toBeVisible()
  expect(await themeAttribute(page)).toBe('oscuro')
  await page.goto('/settings/appearance')
  await page.getByRole('radio', { name: 'Claro' }).click()
  expect(await themeAttribute(page)).toBeNull()
  expect(await page.evaluate(() => localStorage.getItem('tema'))).toBeNull()
  expect(await htmlBackground(page)).toBe(PAPEL)
  await page.reload()
  expect(await themeAttribute(page)).toBeNull()
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
    localStorage.setItem('tema', 'oscuro')
  })

  const email = await signUp(page)
  await logOut(page)

  await page.goto('/entrar')
  expect(await htmlBackground(page)).toBe(PAPEL_OSCURO)

  await page.goto(newBusinessInvitationUrl())
  await expect(page.getByLabel('Nombre del negocio')).toBeVisible()
  expect(await themeAttribute(page)).toBe('oscuro')
  expect(await htmlBackground(page)).toBe(PAPEL_OSCURO)

  await page.goto(resetLink(email))
  await expect(page.getByLabel('Contraseña nueva')).toBeVisible()
  expect(await themeAttribute(page)).toBe('oscuro')
  expect(await htmlBackground(page)).toBe(PAPEL_OSCURO)

  expect(messages).toEqual([])
})

test('a tampered stored value reads as light and is left alone', async ({ page }) => {
  const messages: string[] = []
  watchConsole(page, messages)
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.addInitScript(() => {
    localStorage.setItem('tema', 'claro')
  })

  await page.goto('/entrar')

  expect(await themeAttribute(page)).toBeNull()
  expect(await htmlBackground(page)).toBe(PAPEL)
  expect(await page.evaluate(() => localStorage.getItem('tema'))).toBe('claro')
  expect(messages).toEqual([])
})

test('the storage helper rejects a stored claro, a second key, session storage and an IndexedDB database', async ({ page }) => {
  await page.goto('/entrar')
  await expectOnlyTheThemeStored(page)

  await page.evaluate(() => localStorage.setItem('tema', 'claro'))
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
})
