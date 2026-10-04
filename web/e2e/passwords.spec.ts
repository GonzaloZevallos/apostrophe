/**
 * Change and Reset's own end-to-end run (plan, "Reset"/"Change"; PRD metrics 1,
 * 2, "No curl"), against the real backend, through the built front alone — never
 * a mock of either side. `resetLink` (`backend.ts`) is the one step done from
 * outside the front: printing a reset link the way `scripts/reset-password.sh`
 * does for an operator, never `curl`.
 *
 * This spec first goes green once this branch is rebased onto the merged
 * `backend` subtask (`/auth/password`, `/reset-links/{token}`, the
 * `reset-password` CLI command): it type-checks and lints here, and integration
 * runs it for real.
 *
 * A phone viewport (PRD metric 1: "from the phone... in under a minute"), the
 * same breakpoint `sales.spec.ts` uses.
 */

import { expect, test } from '@playwright/test'
import { newBusinessInvitationUrl, resetLink } from './backend.js'
import { watchConsole } from './console.js'

const PASSWORD = 'correcthorsebattery'
const NEW_PASSWORD = 'unanuevaclave99'

test.use({ viewport: { width: 390, height: 844 } })

test('changes a password from Negocio in under a minute, signing an older device out and keeping this one', async ({
  page,
  browser,
}) => {
  const consoleMessages: string[] = []
  watchConsole(page, consoleMessages)

  const ownerEmail = `duena-clave-${Date.now()}@example.com`
  const businessName = `Flores del Cambio ${Date.now()}`

  await page.goto(newBusinessInvitationUrl())
  await page.getByLabel('Nombre del negocio').fill(businessName)
  await page.getByLabel('Email').fill(ownerEmail)
  await page.getByLabel('Contraseña').fill(PASSWORD)
  await page.getByRole('button', { name: 'Creá el negocio' }).click()
  await expect(page.locator('.encabezado__negocio')).toHaveText(businessName)

  // A second device, signed in as the same user.
  const otherContext = await browser.newContext()
  const otherPage = await otherContext.newPage()
  watchConsole(otherPage, consoleMessages)
  await otherPage.goto('/entrar')
  await otherPage.getByLabel('Email').fill(ownerEmail)
  await otherPage.getByLabel('Contraseña').fill(PASSWORD)
  await otherPage.getByRole('button', { name: 'Entrá' }).click()
  await expect(otherPage.locator('.encabezado__negocio')).toHaveText(businessName)

  const startedAt = Date.now()

  await page.goto('/negocio')
  await page.getByRole('button', { name: 'Cambiar contraseña' }).click()
  await page.getByLabel('Contraseña actual').fill(PASSWORD)
  await page.getByLabel('Contraseña nueva').fill(NEW_PASSWORD)
  await page.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByText('Contraseña cambiada · cerramos tus otras sesiones')).toBeVisible()

  expect(Date.now() - startedAt).toBeLessThan(60_000)

  // This device stays signed in.
  await page.reload()
  await expect(page.locator('.encabezado__negocio')).toHaveText(businessName)

  // The older device is signed out.
  await otherPage.reload()
  await expect(otherPage).toHaveURL(/\/entrar$/)
  await otherContext.close()

  const storage = await page.evaluate(() => ({
    local: Object.keys(localStorage).length,
    session: Object.keys(sessionStorage).length,
  }))
  expect(storage).toEqual({ local: 0, session: 0 })
  expect(consoleMessages).toEqual([])
})

test('resets a forgotten password from a printed link through to Inicio, then shows the dead-link state once used', async ({
  page,
}) => {
  const consoleMessages: string[] = []
  watchConsole(page, consoleMessages)

  const ownerEmail = `duena-reset-${Date.now()}@example.com`
  const businessName = `Flores del Reinicio ${Date.now()}`

  await page.goto(newBusinessInvitationUrl())
  await page.getByLabel('Nombre del negocio').fill(businessName)
  await page.getByLabel('Email').fill(ownerEmail)
  await page.getByLabel('Contraseña').fill(PASSWORD)
  await page.getByRole('button', { name: 'Creá el negocio' }).click()
  await expect(page.locator('.encabezado__negocio')).toHaveText(businessName)

  const link = resetLink(ownerEmail)

  await page.goto(link)
  await expect(page.getByText('Elegí tu contraseña nueva')).toBeVisible()
  await page.getByLabel('Contraseña nueva').fill(NEW_PASSWORD)
  await page.getByRole('button', { name: 'Guardar y entrar' }).click()
  await expect(page.locator('.encabezado__negocio')).toHaveText(businessName)

  // The same link, spent, now shows the dead-link state.
  await page.goto(link)
  await expect(
    page.getByText('Este enlace ya no sirve. Pedile uno nuevo a quien te lo pasó.'),
  ).toBeVisible()

  const storage = await page.evaluate(() => ({
    local: Object.keys(localStorage).length,
    session: Object.keys(sessionStorage).length,
  }))
  expect(storage).toEqual({ local: 0, session: 0 })
  expect(consoleMessages).toEqual([])
})
