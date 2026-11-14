/**
 * `signUpNewBusiness`: the one way an e2e spec signs a new business up (GH-110). The
 * steps are the seller's own — accept a new-business invitation on the invitation
 * screen — and nothing in them waits by the clock: every wait is a locator assertion,
 * on the `expect` ceiling `playwright.config.ts` sets once.
 *
 * "Creá el negocio" is disabled while the request is in flight (`Invitacion.tsx`), so
 * the helper checks every field holds what it just typed, and that the button is enabled,
 * before it clicks: a click on a disabled button would be a silent no-op, and the
 * failure would show up later, somewhere else.
 *
 * Exceptions, named where they stay inline: `catalogInsecureOrigin.spec.ts`, which
 * opens the invitation on an origin other than the project's base URL on purpose.
 */

import { expect } from '../fixtures.js'
import type { Page } from '@playwright/test'
import { HOME, SETTINGS_BUSINESS } from '../../src/routes.js'
import { newBusinessInvitationUrl } from '../backend.js'
import { uniqueTag } from './unique.js'

export const DEFAULT_PASSWORD = 'correcthorsebattery'

export interface SignUpOptions {
  businessName?: string
  email?: string
  password?: string
  /** Stay in the Onboarding the accept lands in (the Onboarding's own specs). */
  stayInOnboarding?: boolean
}

export interface SignedUpBusiness {
  businessName: string
  email: string
  password: string
}

/**
 * A new-business accept lands in the Onboarding (GH-86); the specs that sign up are
 * about something else, so they close it to reach Inicio, the way a seller who skips it
 * does. "Close" on an untouched step sends nothing.
 */
export async function leaveOnboarding(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Close' }).click()
  await expect(page.locator('.inicio-cabecera')).toBeVisible()
}

/**
 * The business a phone session landed in. The phone's Home header shows no business name, so the
 * name is read where the phone still shows it, the Business group of Configuración, and the
 * page goes back to Home (`.inicio-cabecera`, drawn on both viewports) for the spec to go on. It
 * starts from a page that has landed on Home.
 */
export async function expectBusinessNameOnPhone(page: Page, businessName: string): Promise<void> {
  // Landed first: a navigation now would cut a sign-in or a sign-up still on its way.
  await expect(page.locator('.inicio-cabecera')).toBeVisible()
  await page.goto(SETTINGS_BUSINESS)
  await expect(page.getByLabel('Business name')).toHaveValue(businessName)
  await page.goto(HOME)
  await expect(page.locator('.inicio-cabecera')).toBeVisible()
}

export async function signUpNewBusiness(
  page: Page,
  options: SignUpOptions = {},
): Promise<SignedUpBusiness> {
  const unique = `${uniqueTag()}`
  const {
    businessName = `Negocio ${unique}`,
    email = `duena-${unique}@example.com`,
    password = DEFAULT_PASSWORD,
    stayInOnboarding = false,
  } = options

  await page.goto(newBusinessInvitationUrl())

  const nameField = page.getByLabel('Business name', { exact: true })
  const emailField = page.getByLabel('Email address', { exact: true })
  const passwordField = page.getByLabel('Password', { exact: true })
  await nameField.fill(businessName)
  await emailField.fill(email)
  await passwordField.fill(password)
  await expect(nameField).toHaveValue(businessName)
  await expect(emailField).toHaveValue(email)
  await expect(passwordField).toHaveValue(password)

  const create = page.getByRole('button', { name: 'Create the business' })
  await expect(create).toBeEnabled()
  await create.click()
  if (!stayInOnboarding) await leaveOnboarding(page)

  return { businessName, email, password }
}
