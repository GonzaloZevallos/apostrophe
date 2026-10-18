/// <reference lib="dom" />
/**
 * The catalog task's own end-to-end run (plan, "Testing": the Playwright main flow
 * Más → Catálogo → edit → Copiar). A seller adds a variety with a price and stock,
 * opens Catálogo, edits that variety's attributes and, in Configuración, the
 * business's header and footer, then copies the result — all through the built front, against the real
 * backend (PRD, M1: "no `curl` at any point"; "No curl" metric: "the clipboard
 * equals the API's text, and the preview with markers removed equals it too").
 *
 * Runs on `127.0.0.1` (this config's default project base URL), which Chromium
 * treats as a secure context regardless of the plain-http scheme (the one carve-out
 * in the platform's own secure-context rule): `copyText` takes its
 * `navigator.clipboard.writeText` path here, not the `execCommand` fallback, which
 * `catalogInsecureOrigin.spec.ts` exercises on a genuinely insecure origin instead.
 */

import { CATALOG, SETTINGS_CATALOG_MESSAGE, STOCK_ENTRY_NEW, VARIETIES } from '../src/routes.js'
import { expectPath } from './helpers/url.js'
import { expect, test } from './fixtures.js'
import { signUpNewBusiness } from './helpers/signup.js'
import { watchConsole } from './console.js'
import { openCatalog } from './helpers/openMas.js'
import { uniqueTag } from './helpers/unique.js'

test('a seller edits a variety, the header and footer, then copies today\'s catalog', async ({
  page,
  context,
}) => {
  const consoleMessages: string[] = []
  watchConsole(page, consoleMessages)
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])

  const ownerEmail = `duena-catalogo-${uniqueTag()}@example.com`
  const businessName = `Flores del Catálogo ${uniqueTag()}`

  await signUpNewBusiness(page, { businessName, email: ownerEmail })
  await expect(page.locator('.encabezado__negocio')).toHaveText(businessName)

  // A variety with a price and stock, so the catalog has something to show.
  await page.goto(VARIETIES)
  await page.getByRole('link', { name: 'Nueva variedad' }).click()
  await page.getByLabel('Nombre').fill('Rosa')
  await page.getByRole('button', { name: 'Agregá la variedad' }).click()
  await expect(page.getByText('Variedad guardada')).toBeVisible()
  await page.getByRole('link', { name: /Rosa/ }).click()
  await page.getByRole('link', { name: 'Nuevo precio' }).click()
  await page.getByLabel(/^Precio de lista/).fill('9000')
  await page.getByRole('button', { name: 'Guardá el precio' }).click()
  await expect(page.getByText('Precio guardado')).toBeVisible()

  await page.goto(STOCK_ENTRY_NEW)
  await page.getByLabel('Gramos').fill('50')
  await page.getByLabel('Variedad').selectOption({ label: 'Rosa' })
  await page.getByLabel('Costo total').fill('45000')
  await page.getByRole('button', { name: 'Guardá la entrada' }).click()
  await expect(page.getByText('Entry saved')).toBeVisible()

  // Variedades → Mandar catálogo.
  await openCatalog(page)
  await expectPath(page, CATALOG)

  // Edit Rosa's catalog attributes on its own page, from "En el catálogo".
  await page.goto(VARIETIES)
  await page.getByRole('link', { name: /Rosa/ }).click()
  await page.getByRole('button', { name: 'Editar catálogo' }).click()
  await page.getByLabel('Emoji').fill('🌹')
  await page.getByLabel('% índica').fill('30')
  await page.getByLabel('Aroma/sabor').fill('floral, dulce')
  await page.getByRole('button', { name: 'Guardá el catálogo' }).click()
  await expect(page.getByText('Catálogo guardado')).toBeVisible()
  await expect(page.getByText('floral, dulce')).toBeVisible()
  await page.goto(CATALOG)

  // Edit the header and footer in Configuración → Mensaje del catálogo, then close back
  // to the catalog screen, which only links out to it and shows neither value.
  await page.getByRole('link', { name: 'Editar encabezado y pie' }).click()
  await expectPath(page, SETTINGS_CATALOG_MESSAGE)
  await page.getByLabel('Header').fill('🌸 Catálogo de Flores del Catálogo 🌸')
  await page.getByLabel('Footer').fill('Pedidos por privado.')
  await page.getByRole('button', { name: 'Save the message' }).click()
  await expect(page.getByText('Catalog saved')).toBeVisible()
  await page.getByRole('button', { name: 'Close' }).click()
  await expectPath(page, CATALOG)
  await expect(page.getByLabel('Footer')).toHaveCount(0)

  // The API's own text is what both the preview and the clipboard must match.
  const apiText = await page.evaluate(() =>
    fetch('/catalog', { credentials: 'include' })
      .then((response) => response.json() as Promise<{ text: string | null }>)
      .then((body) => body.text),
  )
  expect(apiText).not.toBeNull()
  if (apiText === null) throw new Error('unreachable: asserted above')

  await expect
    .poll(() => page.locator('.catalogo__vista-previa').textContent())
    .toBe(apiText.replaceAll('**', ''))

  await page.getByRole('button', { name: 'Copiar' }).click()
  await expect(page.getByText('Catálogo copiado')).toBeVisible()
  const clipboardText = await page.evaluate(() => navigator.clipboard.readText())
  expect(clipboardText).toBe(apiText)

  expect(consoleMessages).toEqual([])
})
