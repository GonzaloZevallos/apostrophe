/**
 * Sign in on a phone and its Forgot sheet (GH-521), against the real backend through the built
 * front. Phone viewports in light and dark: the email has the focus on open, the form is inside
 * the first screen, and a short screen still reaches Sign in. One tap on "Forgot your password?"
 * opens the sheet, also while the brake message shows; the system back closes it with what was
 * typed intact, and opening or closing it sends nothing to `/auth/*`.
 */

import type { Browser, Page } from '@playwright/test'
import { HOME, LOGIN } from '../src/routes.js'
import { BRAKE_MESSAGE, FORGOT_SHEET_TEXT } from '../src/copy/auth.js'
import { expect, test, withToastRecorder } from './fixtures.js'
import { signUpNewBusiness } from './helpers/signup.js'
import { uniqueTag } from './helpers/unique.js'

const FORGOT = 'Forgot your password?'
const PHONES = [
  { width: 320, height: 568 },
  { width: 375, height: 812 },
]
const SHORT = [
  { width: 320, height: 300 },
  { width: 375, height: 420 },
]
const PHONE = { width: 375, height: 812 }
const SCHEMES = ['light', 'dark'] as const

async function signedUpOwner(browser: Browser, baseURL: string) {
  const context = await withToastRecorder(browser.newContext({ baseURL }))
  const page = await context.newPage()
  const owner = await signUpNewBusiness(page, {
    businessName: `Flores del Ingreso ${uniqueTag()}`,
    email: `ingreso-${uniqueTag()}@example.com`,
  })
  await context.close()
  return owner
}

async function freshPhone(
  browser: Browser,
  baseURL: string,
  viewport: { width: number; height: number },
  colorScheme: (typeof SCHEMES)[number],
): Promise<Page> {
  const context = await withToastRecorder(browser.newContext({ baseURL, viewport, colorScheme }))
  return context.newPage()
}

async function expectInsideTheScreen(page: Page, names: string[]): Promise<void> {
  const height = page.viewportSize()?.height ?? 0
  for (const name of names) {
    const box = await page.getByRole('button', { name }).or(page.getByLabel(name, { exact: true })).first().boundingBox()
    expect(box).not.toBeNull()
    expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(height)
  }
}

for (const scheme of SCHEMES) {
  for (const viewport of PHONES) {
    test(`signs in in one pass at ${viewport.width}x${viewport.height}, ${scheme}`, async ({
      browser,
      workerServer,
    }) => {
      const owner = await signedUpOwner(browser, workerServer.url)
      const page = await freshPhone(browser, workerServer.url, viewport, scheme)
      await page.goto(LOGIN)

      await expect(page.getByLabel('Email address', { exact: true })).toBeFocused()
      await expectInsideTheScreen(page, ['Email address', 'Password', 'Sign in'])
      await page.getByLabel('Email address', { exact: true }).fill(owner.email)
      await page.getByLabel('Password', { exact: true }).fill(owner.password)
      await page.getByRole('button', { name: 'Sign in' }).click()

      await expect(page.locator('.encabezado__negocio')).toHaveText(owner.businessName)
      expect(new URL(page.url()).pathname).toBe(HOME)
      await page.context().close()
    })
  }

  for (const viewport of SHORT) {
    test(`keeps the email in view and reaches Sign in at ${viewport.width}x${viewport.height}, ${scheme}`, async ({
      browser,
      workerServer,
    }) => {
      const owner = await signedUpOwner(browser, workerServer.url)
      const page = await freshPhone(browser, workerServer.url, viewport, scheme)
      await page.goto(LOGIN)

      await expect(page.getByLabel('Email address', { exact: true })).toBeFocused()
      await expect(page.getByLabel('Email address', { exact: true })).toBeInViewport()
      await page.getByLabel('Email address', { exact: true }).fill(owner.email)
      await page.getByLabel('Password', { exact: true }).fill(owner.password)
      await page.getByRole('button', { name: 'Sign in' }).scrollIntoViewIfNeeded()
      await page.getByRole('button', { name: 'Sign in' }).click()

      await expect(page.locator('.encabezado__negocio')).toHaveText(owner.businessName)
      await page.context().close()
    })
  }

  test(`opens the Forgot sheet in one tap, also under the brake, and back closes it, ${scheme}`, async ({
    browser,
    workerServer,
  }) => {
    const page = await freshPhone(browser, workerServer.url, PHONE, scheme)
    const authRequests: string[] = []
    page.on('request', (request) => {
      if (new URL(request.url()).pathname.startsWith('/auth/')) authRequests.push(request.url())
    })
    await page.route('**/auth/login', (route) =>
      route.fulfill({ status: 429, json: { detail: 'too many failed attempts', code: 'account.login_locked' } }),
    )
    await page.goto(LOGIN)
    await page.getByLabel('Email address', { exact: true }).fill('ana@example.com')
    await page.getByLabel('Password', { exact: true }).fill('equivocada123')

    await page.getByRole('button', { name: FORGOT }).click()
    await expect(page.getByRole('dialog', { name: FORGOT })).toContainText(FORGOT_SHEET_TEXT.whatToAsk)
    await page.goBack()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(page.getByLabel('Email address', { exact: true })).toHaveValue('ana@example.com')
    await expect(page.getByLabel('Password', { exact: true })).toHaveValue('equivocada123')
    expect(authRequests).toEqual([])

    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page.getByText(BRAKE_MESSAGE)).toBeVisible()
    authRequests.length = 0
    await page.getByRole('button', { name: FORGOT }).click()
    await expect(page.getByRole('dialog', { name: FORGOT })).toBeVisible()
    await page.getByRole('button', { name: 'Close' }).click()
    await expect(page.getByText(BRAKE_MESSAGE)).toBeVisible()
    expect(authRequests).toEqual([])
    await page.context().close()
  })
}
