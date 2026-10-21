/**
 * Configuración end to end, from a phone viewport (PRD metric "Nothing lost, no curl";
 * criteria 3 and 4): one business, opened from Inicio's avatar, and every group done through
 * the screen alone against the real backend wired to `FakeTelegram` — rename the business,
 * create a join link, Probarlo and follow the link to the catalog screen, edit the header and
 * footer, add / rename / remove a category (a removal refused while it still has expenses),
 * switch Apariencia, change the password and log out by tapping "Cerrar sesión", then sign in
 * again with the new password. Browser storage holds only the theme choice at the end, and
 * the console holds nothing.
 */

import { CATALOG, HOME, LOGIN } from '../src/routes.js'
import { expectPath } from './helpers/url.js'
import { expect, test } from './fixtures.js'
import { signUpNewBusiness } from './helpers/signup.js'
import { watchConsole } from './console.js'
import { expectOnlyTheThemeStored } from './helpers/storage.js'
import { openGastos } from './helpers/openMas.js'
import { uniqueTag } from './helpers/unique.js'

const PASSWORD = 'correcthorsebattery'
const NEW_PASSWORD = 'unanuevaclave99'

test.use({ viewport: { width: 390, height: 844 } })

test('a seller goes through every Configuración group from the phone, with no curl', async ({
  page,
}) => {
  const consoleMessages: string[] = []
  watchConsole(page, consoleMessages)

  const ownerEmail = `duena-config-${uniqueTag()}@example.com`
  const businessName = `Flores de Ajustes ${uniqueTag()}`

  await signUpNewBusiness(page, { businessName, email: ownerEmail })
  await expect(page.locator('.encabezado__negocio')).toHaveText(businessName)

  // A category with an expense in it, so its removal is refused later.
  await openGastos(page)
  await page.getByRole('link', { name: 'Add expense' }).click()
  await page.getByRole('button', { name: 'Crear una categoría nueva' }).click()
  await page.getByLabel('Nombre de la categoría nueva').fill('Flete')
  await page.getByRole('button', { name: 'Crear categoría' }).click()
  await page.getByLabel('Amount').fill('4500')
  await page.getByLabel('Detalle').fill('Flete al mercado')
  await page.getByRole('button', { name: 'Guardá el gasto' }).click()
  await expect(page.getByText('Gasto guardado')).toBeVisible()

  // One tap from Inicio's avatar: the list of groups, then a group, then "Close" back.
  const openGroup = async (name: string): Promise<void> => {
    await page.getByRole('link', { name, exact: true }).click()
  }
  const close = async (): Promise<void> => {
    await page.getByRole('button', { name: 'Close', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()
  }
  await page.goto(HOME)
  await page.getByRole('link', { name: /^Settings for / }).click()
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()

  // Negocio.
  const renamedTo = `${businessName} Renombrado`
  await openGroup('Business')
  await page.getByLabel('Business name').fill(renamedTo)
  await page.getByRole('button', { name: 'Save the name' }).click()
  await expect(page.getByText('Negocio renombrado')).toBeVisible()
  await close()

  // Usuarios: a fresh join link.
  await openGroup('Users')
  await page.getByRole('button', { name: 'Invitá a un socio' }).click()
  await expect(page.locator('.usuarios__link')).not.toHaveText('')
  await close()

  // Integraciones: Probarlo, then the link to the catalog screen.
  await openGroup('Integraciones')
  await page.getByLabel('Token del bot').fill('123456:fake-token-for-e2e')
  await page.getByLabel('Tu chat').fill('111111')
  await page.getByRole('button', { name: 'Probarlo' }).click()
  await expect(page.getByText('Prueba enviada')).toBeVisible()
  await page.getByRole('link', { name: 'Ir al catálogo' }).click()
  await expectPath(page, CATALOG)
  await page.goBack()
  await close()

  // Mensaje del catálogo.
  await openGroup('Catalog message')
  await page.getByLabel('Encabezado').fill('🌿 Catálogo de la semana')
  await page.getByLabel('Pie').fill('Consultas por privado.')
  await page.getByRole('button', { name: 'Guardá el mensaje' }).click()
  await expect(page.getByText('Catálogo guardado')).toBeVisible()
  await close()

  // Categorías de gastos: add, rename, a refused removal, then remove.
  await openGroup('Expense categories')
  await page.getByLabel('Nueva categoría').fill('Delivery en bici')
  await page.getByRole('button', { name: '+ Categoría' }).click()
  await expect(page.getByText('Categoría guardada')).toBeVisible()
  const delivery = page.locator('.fila', { hasText: 'Delivery en bici' })
  await delivery.getByRole('button', { name: 'Renombrar' }).click()
  await page.getByLabel('Nombre de Delivery en bici').fill('Mensajería')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.locator('.fila', { hasText: 'Mensajería' })).toBeVisible()
  await page.locator('.fila', { hasText: 'Flete' }).getByRole('button', { name: 'Eliminar' }).click()
  await page.getByRole('button', { name: 'Yes, delete it' }).click()
  await expect(
    page.getByText('No se puede borrar: todavía tiene gastos. Podés renombrarla.'),
  ).toBeVisible()
  await page.locator('.fila', { hasText: 'Mensajería' }).getByRole('button', { name: 'Eliminar' }).click()
  await page.getByRole('button', { name: 'Yes, delete it' }).click()
  await expect(page.getByText('Categoría eliminada')).toBeVisible()
  await expect(page.getByText('Mensajería')).toHaveCount(0)
  await close()

  // Apariencia: Oscuro applies at once, Claro removes it.
  await openGroup('Appearance')
  await page.getByRole('radio', { name: 'Oscuro' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-tema', 'oscuro')
  await page.getByRole('radio', { name: 'Claro' }).click()
  await expect(page.locator('html')).not.toHaveAttribute('data-tema', /.*/)
  await close()

  // Tu cuenta: change the password, then log out by tapping "Cerrar sesión".
  await openGroup('Your account')
  await page.getByRole('button', { name: 'Change password' }).click()
  const sheet = page.locator('.capa')
  await sheet.getByLabel('Current password').fill(PASSWORD)
  await sheet.getByLabel('New password').fill(NEW_PASSWORD)
  await sheet.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText('Contraseña cambiada · cerramos tus otras sesiones')).toBeVisible()
  await page.getByRole('button', { name: 'Cerrar sesión' }).click()
  await expectPath(page, LOGIN)

  await page.getByLabel('Email address').fill(ownerEmail)
  await page.getByLabel('Password').fill(NEW_PASSWORD)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.locator('.encabezado__negocio')).toHaveText(renamedTo)

  await expectOnlyTheThemeStored(page)
  // The refused removal answers 409, and Chromium logs every failed resource load by itself;
  // that one line carries no data, so it is excluded by exact text.
  const REFUSED_REMOVAL_NETWORK_LOG =
    'error: Failed to load resource: the server responded with a status of 409 (Conflict)'
  expect(consoleMessages.filter((message) => message !== REFUSED_REMOVAL_NETWORK_LOG)).toEqual([])
})
