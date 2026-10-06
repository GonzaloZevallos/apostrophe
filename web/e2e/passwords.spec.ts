/**
 * Change and Reset's own end-to-end run (plan, "Reset"/"Change"; PRD metrics 1,
 * 2, "No curl"), against the real backend, through the built front alone — never
 * a mock of either side. `resetLink` (`backend.ts`) is the one step done from
 * outside the front: printing a reset link the way `scripts/reset-password.sh`
 * does for an operator, never `curl`.
 *
 * This spec first goes green once this branch is rebased onto the merged
 * `backend` subtask (`/auth/password`, `/reset-links/{token}`, the
 * `reset-password` CLI command). Until then, each test probes
 * `supportsPasswordReset()` first and skips, named, rather than fail — the
 * backend's own `reset-password` subcommand does not exist yet on this branch,
 * and there is no front-only way to make it exist. The probe itself needs no
 * edit once the backend lands: it starts finding the real command and the
 * skip stops firing on its own.
 *
 * A phone viewport (PRD metric 1: "from the phone... in under a minute"), the
 * same breakpoint `sales.spec.ts` uses.
 */

import { expect, test } from '@playwright/test'
import { newBusinessInvitationUrl, resetLink, supportsPasswordReset } from './backend.js'
import { watchConsole } from './console.js'
import { expectOnlyTheThemeStored } from './helpers/storage.js'

const PASSWORD = 'correcthorsebattery'
const NEW_PASSWORD = 'unanuevaclave99'

test.use({ viewport: { width: 390, height: 844 } })

test('changes a password from Configuración → Tu cuenta in under a minute, signing an older device out and keeping this one', async ({
  page,
  browser,
}) => {
  test.skip(
    !supportsPasswordReset(),
    "needs the backend subtask's /auth/password and reset-password CLI, not yet merged onto this branch",
  )

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

  await page.goto('/settings/account')
  await page.getByRole('button', { name: 'Cambiar contraseña' }).click()
  const sheet = page.locator('.capa')
  await sheet.getByLabel('Contraseña actual').fill(PASSWORD)
  await sheet.getByLabel('Contraseña nueva').fill(NEW_PASSWORD)
  await sheet.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByText('Contraseña cambiada · cerramos tus otras sesiones')).toBeVisible()

  expect(Date.now() - startedAt).toBeLessThan(60_000)

  // This device stays signed in: `.encabezado__negocio` only renders on Inicio
  // (`Inicio.tsx`), never on a Configuración group itself, so the check navigates home rather
  // than reloading the settings screen it was already on.
  await page.goto('/')
  await expect(page.locator('.encabezado__negocio')).toHaveText(businessName)

  // The older device is signed out: its gated calls now answer 401, which is
  // exactly the point of this check, and Chromium logs every failed resource
  // load on its own, including a `fetch`'s. That line carries no password,
  // token, digest or email, so it is excluded by exact text below rather than
  // relaxing the "no console output at all" check generally.
  const EXPECTED_SIGNED_OUT_NETWORK_LOG =
    'error: Failed to load resource: the server responded with a status of 401 (Unauthorized)'
  await otherPage.reload()
  await expect(otherPage).toHaveURL(/\/entrar$/)
  await otherContext.close()

  await expectOnlyTheThemeStored(page)
  expect(consoleMessages.filter((message) => message !== EXPECTED_SIGNED_OUT_NETWORK_LOG)).toEqual([])
})

test('resets a forgotten password from a printed link through to Inicio, then shows the dead-link state once used', async ({
  page,
}) => {
  test.skip(
    !supportsPasswordReset(),
    "needs the backend subtask's reset-password CLI and /reset-links/{token}, not yet merged onto this branch",
  )

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

  // The same link, spent, now shows the dead-link state. The lookup itself
  // answers 404 account.reset_link_gone — expected, not a leak — and Chromium
  // logs every failed resource load to the console on its own, including a
  // `fetch`'s; this is the one console line the dead-link path cannot avoid, and
  // it carries no password, token, digest or email, so it is excluded by exact
  // text rather than relaxing the "no console output at all" check generally.
  const EXPECTED_DEAD_LINK_NETWORK_LOG =
    'error: Failed to load resource: the server responded with a status of 404 (Not Found)'
  await page.goto(link)
  await expect(
    page.getByText('Este enlace ya no sirve. Pedile uno nuevo a quien te lo pasó.'),
  ).toBeVisible()

  await expectOnlyTheThemeStored(page)
  expect(consoleMessages.filter((message) => message !== EXPECTED_DEAD_LINK_NETWORK_LOG)).toEqual([])
})
