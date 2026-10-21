/// <reference lib="dom" />
/**
 * The first-run matrix on Inicio (navigation.md, criterion 12), phone and computer, against
 * the real backend through the built front: a brand-new business sees only the Onboarding
 * notice (never the checklist, the after-import notice or "Arrancá por las variedades"), and a
 * user who joined by a join invitation sees the element of the business they joined.
 *
 * A business that existed before the Onboarding, and an imported one, cannot be made with
 * the e2e backend's own commands (`python -m tests.e2e_app`: offset, invite-business,
 * reset-password), and no row is built by hand: those two states are covered with Testing
 * Library, in `src/screens/Inicio.test.tsx` and the Shell and Variedades tests.
 */

import { SETTINGS_USERS } from '../src/routes.js'
import { watchConsole } from './console.js'
import { expect, test } from './fixtures.js'
import { signUpNewBusiness, leaveOnboarding, DEFAULT_PASSWORD } from './helpers/signup.js'
import { expectOnlyTheThemeStored } from './helpers/storage.js'
import { uniqueTag } from './helpers/unique.js'

const VIEWPORTS = [
  { name: 'phone', width: 390, height: 844 },
  { name: 'computer', width: 1280, height: 800 },
]

const ONBOARDING_NOTICE = 'Seguí con la configuración'
const NOT_THERE = [
  'Para arrancar',
  'Arrancá por las variedades',
  'Conectá el bot para que el catálogo fijado se actualice solo',
  'Cargale un precio a una variedad para poder vender',
]

for (const viewport of VIEWPORTS) {
  test(`a brand-new business sees only the Onboarding notice, and a partner who joins sees the same (${viewport.name})`, async ({
    page,
    browser,
    workerServer,
  }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height })
    const consoleMessages: string[] = []
    watchConsole(page, consoleMessages)

    await signUpNewBusiness(page, { stayInOnboarding: true })
    await leaveOnboarding(page)

    await expect(page.getByText(ONBOARDING_NOTICE)).toBeVisible()
    for (const text of NOT_THERE) await expect(page.getByText(text)).toHaveCount(0)

    await page.goto(SETTINGS_USERS)
    await page.getByRole('button', { name: 'Invite a partner' }).click()
    await expect(page.locator('.usuarios__link')).toHaveText(/^https?:\/\//)
    const inviteUrl = await page.locator('.usuarios__link').textContent()
    if (inviteUrl === null || inviteUrl === '') throw new Error('no invitation link shown')

    const partnerContext = await browser.newContext({
      baseURL: workerServer.url,
      viewport: { width: viewport.width, height: viewport.height },
    })
    const partnerPage = await partnerContext.newPage()
    watchConsole(partnerPage, consoleMessages)
    await partnerPage.goto(inviteUrl)
    await partnerPage.getByLabel('Email').fill(`socio-${uniqueTag()}@example.com`)
    await partnerPage.getByLabel('Contraseña').fill(DEFAULT_PASSWORD)
    await partnerPage.getByRole('button', { name: /^Sumate a / }).click()
    await expect(partnerPage.locator('.encabezado__negocio')).toBeVisible()

    await expect(partnerPage.getByText(ONBOARDING_NOTICE)).toBeVisible()
    for (const text of NOT_THERE) await expect(partnerPage.getByText(text)).toHaveCount(0)
    await expectOnlyTheThemeStored(partnerPage)
    await partnerContext.close()

    await expectOnlyTheThemeStored(page)
    expect(consoleMessages).toEqual([])
  })
}
