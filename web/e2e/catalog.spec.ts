/// <reference lib="dom" />
/**
 * The catalog task's own end-to-end run (plan, "Testing": the Playwright main flow
 * Más → Catálogo → edit → Copiar). A seller adds a variety with a price and stock,
 * opens Catálogo, edits that variety's attributes and, in Configuración, the
 * business's header and footer, then copies and shares the result — all through the built front, against the real
 * backend (PRD, M1: "no `curl` at any point"; "No curl" metric: "the clipboard
 * and the share sheet get the API's text with its paired `**` removed and every line
 * break kept, and the preview shows the same text"). The server's own text keeps its
 * markers: this spec reads it too, and asserts they are still there.
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
import { expectToast } from './helpers/toast.js'
import { signUpNewBusiness } from './helpers/signup.js'
import { watchConsole } from './console.js'
import { openCatalog } from './helpers/openMas.js'
import { uniqueTag } from './helpers/unique.js'

// What Copiar and Compartir must hand out for the data below, written by hand: the header's
// pair and Rosa's name pair lose their `**`, every `\n` and blank line stays.
const EXPECTED_PLAIN_TEXT =
  '🌸 Catálogo de Flores 🌸\n\n' +
  '🌹 Rosa\n• 30% indica / 70% sativa\n• Aroma/flavor: floral, dulce\n• Price per gram: $9.000\n\n' +
  'Pedidos por privado.'

test('a seller edits a variety, the header and footer, then copies and shares today\'s catalog', async ({
  page,
  context,
}) => {
  const consoleMessages: string[] = []
  watchConsole(page, consoleMessages)
  // The share sheet is not driven by Playwright: a stub records what it is handed.
  await page.addInitScript(() => {
    const shared: string[] = []
    ;(window as unknown as { __shared: string[] }).__shared = shared
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: (data: ShareData): Promise<void> => {
        shared.push(data.text ?? '')
        return Promise.resolve()
      },
    })
  })
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])

  const ownerEmail = `duena-catalogo-${uniqueTag()}@example.com`
  const businessName = `Flores del Catálogo ${uniqueTag()}`

  await signUpNewBusiness(page, { businessName, email: ownerEmail })
  await expect(page.locator('.encabezado__negocio')).toHaveText(businessName)

  // A variety with a price and stock, so the catalog has something to show.
  await page.goto(VARIETIES)
  await page.getByRole('link', { name: 'New variety' }).click()
  await page.getByLabel('Name').fill('Rosa')
  await expectToast(page, 'Variety saved', () => page.getByRole('button', { name: 'Add the variety' }).click())
  await page.getByRole('link', { name: /Rosa/ }).click()
  await page.getByRole('link', { name: 'New price' }).click()
  await page.getByLabel(/^List price/).fill('9000')
  await expectToast(page, 'Price saved', () => page.getByRole('button', { name: 'Save the price' }).click())

  await page.goto(STOCK_ENTRY_NEW)
  await page.getByLabel('Grams').fill('50')
  await page.getByLabel('Variety').selectOption({ label: 'Rosa' })
  await page.getByLabel('Total cost').fill('45000')
  await expectToast(page, 'Entry saved', () => page.getByRole('button', { name: 'Save the entry' }).click())

  // Variedades → Mandar catálogo.
  await openCatalog(page)
  await expectPath(page, CATALOG)

  // Edit Rosa's catalog attributes on its own page, from "En el catálogo".
  await page.goto(VARIETIES)
  await page.getByRole('link', { name: /Rosa/ }).click()
  await page.getByRole('button', { name: 'Edit catalog' }).click()
  await page.getByLabel('Emoji').fill('🌹')
  await page.getByLabel('% indica').fill('30')
  await page.getByLabel('Aroma/flavor').fill('floral, dulce')
  await expectToast(page, 'Catalog saved', () => page.getByRole('button', { name: 'Save the catalog' }).click())
  await expect(page.getByText('floral, dulce')).toBeVisible()
  await page.goto(CATALOG)

  // Edit the header and footer in Configuración → Mensaje del catálogo, then close back
  // to the catalog screen, which only links out to it and shows neither value.
  await page.getByRole('link', { name: 'Edit header and footer' }).click()
  await expectPath(page, SETTINGS_CATALOG_MESSAGE)
  await page.getByLabel('Header').fill('🌸 Catálogo de **Flores** 🌸')
  await page.getByLabel('Footer').fill('Pedidos por privado.')
  await expectToast(page, 'Catalog saved', () => page.getByRole('button', { name: 'Save the message' }).click())
  await page.getByRole('button', { name: 'Close' }).click()
  await expectPath(page, CATALOG)
  await expect(page.getByLabel('Footer')).toHaveCount(0)

  // The API's own text keeps its markers; the preview, the clipboard and the share sheet
  // show it without them.
  const apiText = await page.evaluate(() =>
    fetch('/catalog', { credentials: 'include' })
      .then((response) => response.json() as Promise<{ text: string | null }>)
      .then((body) => body.text),
  )
  expect(apiText).not.toBeNull()
  expect(apiText).toContain('**')
  expect(apiText).toBe(
    '🌸 Catálogo de **Flores** 🌸\n\n' +
      '🌹 **Rosa**\n• 30% indica / 70% sativa\n• Aroma/flavor: floral, dulce\n• Price per gram: $9.000\n\n' +
      'Pedidos por privado.',
  )

  await expect
    .poll(() => page.locator('.catalogo__vista-previa').textContent())
    .toBe(EXPECTED_PLAIN_TEXT)

  await expectToast(page, 'Catalog copied', () => page.getByRole('button', { name: 'Copy' }).click())
  const clipboardText = await page.evaluate(() => navigator.clipboard.readText())
  expect(clipboardText).toBe(EXPECTED_PLAIN_TEXT)

  await page.getByRole('button', { name: 'Share' }).click()
  await expect
    .poll(() => page.evaluate(() => (window as unknown as { __shared: string[] }).__shared))
    .toEqual([EXPECTED_PLAIN_TEXT])

  expect(consoleMessages).toEqual([])
})
