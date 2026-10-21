/**
 * Configuración end to end, from a phone viewport (PRD metric "Nothing lost, no curl";
 * criteria 3 and 4): one business, opened from Inicio's avatar, and every group done through
 * the screen alone against the real backend wired to `FakeTelegram` — rename the business,
 * create a join link, Probarlo and follow the link to the catalog screen, edit the header and
 * footer, add / rename / remove a category (a removal refused while it still has expenses),
 * switch Apariencia, change the password and log out by tapping "Sign out", then sign in
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
  await page.getByRole('button', { name: 'Create a new category' }).click()
  await page.getByLabel('New category name').fill('Flete')
  await page.getByRole('button', { name: 'Create category' }).click()
  await page.getByLabel('Amount').fill('4500')
  await page.getByLabel('Details').fill('Flete al mercado')
  await page.getByRole('button', { name: 'Save the expense' }).click()
  await expect(page.getByText('Expense saved')).toBeVisible()

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
  await expect(page.getByText('Business renamed')).toBeVisible()
  await close()

  // Usuarios: a fresh join link.
  await openGroup('Users')
  await page.getByRole('button', { name: 'Invitá a un socio' }).click()
  await expect(page.locator('.usuarios__link')).not.toHaveText('')
  await close()

  // Integraciones: Probarlo, then the link to the catalog screen.
  await openGroup('Integrations')
  await page.getByLabel('Bot token').fill('123456:fake-token-for-e2e')
  await page.getByLabel('Your chat').fill('111111')
  await page.getByRole('button', { name: 'Test it' }).click()
  await expect(page.getByText('Test sent')).toBeVisible()
  await page.getByRole('link', { name: 'Go to the catalog' }).click()
  await expectPath(page, CATALOG)
  await page.goBack()
  await close()

  // Mensaje del catálogo.
  await openGroup('Catalog message')
  await page.getByLabel('Header').fill('🌿 Catálogo de la semana')
  await page.getByLabel('Footer').fill('Consultas por privado.')
  await page.getByRole('button', { name: 'Save the message' }).click()
  await expect(page.getByText('Catalog saved')).toBeVisible()
  await close()

  // Categorías de gastos: add, rename, a refused removal, then remove.
  await openGroup('Expense categories')
  await page.getByLabel('New category').fill('Delivery en bici')
  await page.getByRole('button', { name: '+ Category' }).click()
  await expect(page.getByText('Category saved')).toBeVisible()
  const delivery = page.locator('.fila', { hasText: 'Delivery en bici' })
  await delivery.getByRole('button', { name: 'Rename' }).click()
  await page.getByLabel('Nombre de Delivery en bici').fill('Mensajería')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.locator('.fila', { hasText: 'Mensajería' })).toBeVisible()
  await page.locator('.fila', { hasText: 'Flete' }).getByRole('button', { name: 'Delete' }).click()
  await page.getByRole('button', { name: 'Yes, delete it' }).click()
  await expect(
    page.getByText("It can't be deleted: it still has expenses. You can rename it."),
  ).toBeVisible()
  await page.locator('.fila', { hasText: 'Mensajería' }).getByRole('button', { name: 'Delete' }).click()
  await page.getByRole('button', { name: 'Yes, delete it' }).click()
  await expect(page.getByText('Category deleted')).toBeVisible()
  await expect(page.getByText('Mensajería')).toHaveCount(0)
  await close()

  // Apariencia: Oscuro applies at once, Claro removes it.
  await openGroup('Appearance')
  await page.getByRole('radio', { name: 'Dark' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-tema', 'oscuro')
  await page.getByRole('radio', { name: 'Light' }).click()
  await expect(page.locator('html')).not.toHaveAttribute('data-tema', /.*/)
  await close()

  // Tu cuenta: change the password, then log out by tapping "Sign out".
  await openGroup('Your account')
  await page.getByRole('button', { name: 'Change password' }).click()
  const sheet = page.locator('.capa')
  await sheet.getByLabel('Contraseña actual').fill(PASSWORD)
  await sheet.getByLabel('Contraseña nueva').fill(NEW_PASSWORD)
  await sheet.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText('Password changed · we signed out your other sessions')).toBeVisible()
  await page.getByRole('button', { name: 'Sign out' }).click()
  await expectPath(page, LOGIN)

  await page.getByLabel('Email').fill(ownerEmail)
  await page.getByLabel('Contraseña').fill(NEW_PASSWORD)
  await page.getByRole('button', { name: 'Entrá' }).click()
  await expect(page.locator('.encabezado__negocio')).toHaveText(renamedTo)

  await expectOnlyTheThemeStored(page)
  // The refused removal answers 409, and Chromium logs every failed resource load by itself;
  // that one line carries no data, so it is excluded by exact text.
  const REFUSED_REMOVAL_NETWORK_LOG =
    'error: Failed to load resource: the server responded with a status of 409 (Conflict)'
  expect(consoleMessages.filter((message) => message !== REFUSED_REMOVAL_NETWORK_LOG)).toEqual([])
})
