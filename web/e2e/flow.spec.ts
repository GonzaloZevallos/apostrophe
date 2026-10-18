/**
 * The end-to-end run (plan, "Shape"; PRD M1, "no `curl` at any point"): every step
 * a seller needs before the sales task lands, done through the built front alone,
 * against the real backend. One business, accepted from its invitation link, then
 * a customer, a variety and its price (added and deleted), a stock entry (recorded,
 * edited and deleted) and a low-stock threshold (set and turned off — GH-5 PRD,
 * "No curl (6)"), an expense (recorded, edited and deleted), an expense category
 * (added and removed), the business renamed, and a second user joining through a
 * fresh invitation link.
 *
 * `consoleMessages` is asserted empty at the end (plan, "Observability": "the e2e
 * run asserts zero console messages") — nothing personal or technical belongs in the
 * browser console (CODING_STANDARDS.md section 9, in the browser too).
 */

import { CUSTOMER, CUSTOMER_NEW, EXPENSES, EXPENSE_CATEGORIES, MORE, SETTINGS_BUSINESS, SETTINGS_USERS, STOCK, STOCK_ENTRY, STOCK_ENTRY_NEW, VARIETIES, VARIETY } from '../src/routes.js'
import { legacyFor } from './helpers/legacyPaths.js'
import { expectAnyPath, expectPath } from './helpers/url.js'
import { expect, test } from './fixtures.js'
import { signUpNewBusiness } from './helpers/signup.js'
import { watchConsole } from './console.js'
import { openGastos } from './helpers/openMas.js'
import { uniqueTag } from './helpers/unique.js'

const PASSWORD = 'correcthorsebattery'
const PHONE = '+5491155550001'

test('a seller does everything the backend offers today, from the front alone', async ({
  page,
  browser,
  workerServer,
}) => {
  const consoleMessages: string[] = []
  watchConsole(page, consoleMessages)

  const ownerEmail = `duena-${uniqueTag()}@example.com`
  const businessName = `Flores del Centro ${uniqueTag()}`

  // Accept a new-business invitation.
  await signUpNewBusiness(page, { businessName, email: ownerEmail })
  await expect(page.locator('.encabezado__negocio')).toHaveText(businessName)

  // Add a customer.
  await page.goto(CUSTOMER_NEW)
  await page.getByLabel('Phone').fill(PHONE)
  await page.getByLabel('Name').fill('Marisa Gómez')
  await page.getByRole('button', { name: 'Save and use' }).click()
  await expectPath(page, CUSTOMER)
  await expect(page.getByText('Customer saved')).toBeVisible()

  // Add a variety.
  await page.goto(VARIETIES)
  await page.getByRole('link', { name: 'Nueva variedad' }).click()
  await page.getByLabel('Name').fill('Rosa')
  await page.getByRole('button', { name: 'Agregá la variedad' }).click()
  await expect(page.getByText('Variety guardada')).toBeVisible()
  await page.getByRole('link', { name: /Rosa/ }).click()
  await expectPath(page, VARIETY)

  // Add a price. "Rige desde" already defaults to `me.today` — the business day
  // the backend's clock reports, read through `GET /auth/me` — so it is left as
  // is, never dated from the browser's own UTC clock (plan, "One clock").
  await page.getByRole('link', { name: 'Nuevo precio' }).click()
  await page.getByLabel(/^Precio de lista/).fill('9000')
  await page.getByRole('button', { name: 'Guardá el precio' }).click()
  await expect(page.getByText('Precio guardado')).toBeVisible()
  await expect(page.getByText(/\$ 9\.000 / g/).first()).toBeVisible()

  // Delete the price entry (the only one): the variety is left with no price.
  await page.getByRole('button', { name: 'Borrar este precio' }).click();
  await page.getByRole('button', { name: 'Yes, delete it' }).click();
  await expect(page.getByText('Precio eliminado')).toBeVisible()
  await expect(page.getByText('Sin precio: no se puede vender').first()).toBeVisible()

  // Record a stock entry for Rosa from Variedades ("+ Entrada de stock"), then read it in
  // "Todas las entradas" (stock.md).
  await page.goto(STOCK)
  await expect(page.getByText('Sin entradas de stock')).toBeVisible()
  await page.goto(VARIETIES)
  await page.getByRole('link', { name: '+ Entrada de stock' }).click()
  await expectPath(page, STOCK_ENTRY_NEW)
  await page.getByLabel('Grams').fill('50')
  await page.getByLabel('Variety').selectOption({ label: 'Rosa' })
  await page.getByLabel('Costo total').fill('45000')
  await expect(page.getByText('Te queda en $ 900 el gramo')).toBeVisible()
  await page.getByRole('button', { name: 'Guardá la entrada' }).click()
  await expectAnyPath(page, [VARIETIES, VARIETY])
  await expect(page.getByText('Entry saved')).toBeVisible()
  await page.goto(STOCK)
  await expect(page.getByText('Compra · 50 g')).toBeVisible()

  // Edit it: editing confirms before saving (stock.md).
  await page.getByRole('link', { name: 'Edit' }).click()
  await expectPath(page, STOCK_ENTRY)
  await expect(page.getByLabel('Grams')).toHaveValue('50')
  await page.getByLabel('Grams').fill('60')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText('¿Guardás los cambios?')).toBeVisible()
  await page.getByRole('button', { name: 'Yes, guardar' }).click()
  await expectPath(page, STOCK)
  await expect(page.getByText('Entry saved')).toBeVisible()
  await expect(page.getByText('Compra · 60 g')).toBeVisible()

  // Delete it: confirmed first, naming the date, variety and grams ("Antes de borrar").
  await page.getByRole('button', { name: 'Borrar', exact: true }).click()
  await expect(page.getByText('Antes de borrar')).toBeVisible()
  await page.getByRole('button', { name: 'Yes, delete it' }).click()
  await expectPath(page, STOCK)
  await expect(page.getByText('Entry deleted')).toBeVisible()
  await expect(page.getByText('Compra · 60 g')).toHaveCount(0)

  // Rosa's page: set the low-stock warning through its form (turning it on only opens the
  // form), then turn it off (saved at once).
  await page.goto(VARIETIES)
  await page.getByRole('link', { name: /Rosa/ }).click()
  await expect(page.getByText('Warning off')).toBeVisible()
  await page.getByRole('switch', { name: 'Avisar cuando quede poco' }).click()
  await page.getByLabel('Avisar con menos de').fill('15')
  await page.getByRole('button', { name: 'Guardá el aviso' }).click()
  await expect(page.getByText('Aviso guardado')).toBeVisible()
  await expect(page.getByText('Warn me below 15 g')).toBeVisible()
  await page.getByRole('switch', { name: 'Avisar cuando quede poco' }).click()
  await expect(page.getByText('Warning off')).toBeVisible()

  // Record an expense, with a category created inline.
  await openGastos(page)
  await page.getByRole('link', { name: 'Cargar gasto' }).click()
  await page.getByRole('button', { name: 'Crear una categoría nueva' }).click()
  await page.getByLabel('Name de la categoría nueva').fill('Flete')
  await page.getByRole('button', { name: 'Crear categoría' }).click()
  await page.getByLabel('Amount').fill('4500')
  await page.getByLabel('Detalle').fill('Flete al mercado')
  await page.getByRole('button', { name: 'Guardá el gasto' }).click()
  await expect(page.getByText('Gasto guardado')).toBeVisible()
  await expect(page.getByText('Flete al mercado')).toBeVisible()

  // Edit it.
  await page.getByText('Flete al mercado').click()
  await page.getByLabel('Detalle').fill('Flete al mercado central')
  await page.getByRole('button', { name: 'Guardá el gasto' }).click()
  await expect(page.getByText('Gasto guardado')).toBeVisible()
  await expect(page.getByText('Flete al mercado central')).toBeVisible()

  // Delete it.
  await page.getByText('Flete al mercado central').click()
  await page.getByRole('button', { name: 'Borrar gasto' }).click()
  await page.getByRole('button', { name: 'Yes, delete it' }).click()
  await expect(page.getByText('Gasto eliminado')).toBeVisible()
  await expect(page.getByText('Flete al mercado central')).toHaveCount(0)

  // Move between months: the month lives in the URL, one step back and one forward.
  await page.getByRole('button', { name: 'Month anterior' }).click()
  await expectPath(page, EXPENSES, /\?month=\d{4}-\d{2}/)
  await page.getByRole('button', { name: 'Month siguiente' }).click()
  await expect(page.getByText(/Las compras de flores no van acá/)).toBeVisible()

  // The Spanish paths stay on purpose here: the server answers them with a 308 and the
  // app shows the English screen (the one old Gastos path and one old Más path of
  // the run; every other step reaches a screen through the nav or its real path).
  await page.goto(`${legacyFor(EXPENSES)}?month=2026-01`)
  await expectPath(page, EXPENSES, '?month=2026-01')
  await expect(page.getByText(/Las compras de flores no van acá/)).toBeVisible()
  await page.reload()
  await expectPath(page, EXPENSES, '?month=2026-01')
  await expect(page.getByText(/Las compras de flores no van acá/)).toBeVisible()
  await page.goto(legacyFor(MORE))
  await expectPath(page, MORE)
  await expect(
    page.getByRole('navigation', { name: 'Más' }).getByRole('link', { name: /^Gastos/ }),
  ).toBeVisible()
  await page.reload()
  await expectPath(page, MORE)
  await expect(
    page.getByRole('navigation', { name: 'Más' }).getByRole('link', { name: /^Gastos/ }),
  ).toBeVisible()

  // Add and remove an expense category. "Growing supplies", "Packaging",
  // "Shipping and travel" and "Other" are the four the business starts with
  // (`app/expenses/domain/category.py`'s `DEFAULT_CATEGORY_NAMES`), so this one
  // uses a name of its own.
  await page.goto(EXPENSE_CATEGORIES)
  await page.getByLabel('Nueva categoría').fill('Delivery en bici')
  await page.getByRole('button', { name: '+ Categoría' }).click()
  await expect(page.getByText('Categoría guardada')).toBeVisible()
  const newRow = page.locator('.fila', { hasText: 'Delivery en bici' })
  await newRow.getByRole('button', { name: 'Eliminar' }).click()
  await page.getByRole('button', { name: 'Yes, delete it' }).click()
  await expect(page.getByText('Categoría eliminada')).toBeVisible()
  await expect(page.getByText('Delivery en bici')).toHaveCount(0)

  // Rename the business.
  await page.goto(SETTINGS_BUSINESS)
  const renamedTo = `${businessName} Renombrado`
  await page.getByLabel('Name del negocio').fill(renamedTo)
  await page.getByRole('button', { name: 'Guardá el nombre' }).click()
  await expect(page.getByText('Negocio renombrado')).toBeVisible()

  // Create a join link and accept it as a second user, from a separate browser
  // context (its own cookie jar — a second device).
  await page.goto(SETTINGS_USERS)
  await page.getByRole('button', { name: 'Invitá a un socio' }).click()
  await expect(page.locator('.usuarios__link')).toHaveText(/^https?:\/\//)
  const inviteUrl = await page.locator('.usuarios__link').textContent()
  if (inviteUrl === null || inviteUrl === '') throw new Error('no invitation link shown')

  const partnerContext = await browser.newContext({ baseURL: workerServer.url })
  const partnerPage = await partnerContext.newPage()
  watchConsole(partnerPage, consoleMessages)
  await partnerPage.goto(inviteUrl)
  await expect(partnerPage.locator('.invitacion__titulo')).toHaveText(renamedTo)
  await partnerPage.getByLabel('Email').fill(`socio-${uniqueTag()}@example.com`)
  await partnerPage.getByLabel('Contraseña').fill(PASSWORD)
  await partnerPage.getByRole('button', { name: `Sumate a ${renamedTo}` }).click()
  await expect(partnerPage.locator('.encabezado__negocio')).toHaveText(renamedTo)
  await partnerContext.close()

  expect(consoleMessages).toEqual([])
})
