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

import { expect, test } from '@playwright/test'
import { newBusinessInvitationUrl } from './backend.js'
import { watchConsole } from './console.js'
import { openMas } from './helpers/openMas.js'

const PASSWORD = 'correcthorsebattery'

test('a seller edits a variety, the header and footer, then copies today\'s catalog', async ({
  page,
  context,
}) => {
  const consoleMessages: string[] = []
  watchConsole(page, consoleMessages)
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])

  const ownerEmail = `duena-catalogo-${Date.now()}@example.com`
  const businessName = `Flores del Catálogo ${Date.now()}`

  await page.goto(newBusinessInvitationUrl())
  await page.getByLabel('Nombre del negocio').fill(businessName)
  await page.getByLabel('Email').fill(ownerEmail)
  await page.getByLabel('Contraseña').fill(PASSWORD)
  await page.getByRole('button', { name: 'Creá el negocio' }).click()
  await expect(page.locator('.encabezado__negocio')).toHaveText(businessName)

  // A variety with a price and stock, so the catalog has something to show.
  await page.goto('/varieties')
  await page.getByRole('button', { name: 'Nueva variedad' }).click()
  await page.getByLabel('Nombre').fill('Rosa')
  await page.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByText('Variedad guardada')).toBeVisible()
  await page.getByRole('link', { name: /Rosa/ }).click()
  await page.getByRole('button', { name: 'Nuevo precio' }).click()
  await page.getByLabel('Precio de lista').fill('9000')
  await page.getByRole('button', { name: 'Guardar precio' }).click()
  await expect(page.getByText('Precio guardado')).toBeVisible()

  await page.goto('/varieties/entries/new')
  await page.getByLabel('Gramos').fill('50')
  await page.getByLabel('Variedad').selectOption({ label: 'Rosa' })
  await page.getByLabel('Costo total').fill('45000')
  await page.getByRole('button', { name: 'Guardá la entrada' }).click()
  await expect(page.getByText('Entrada guardada')).toBeVisible()

  // Más → Catálogo.
  await openMas(page)
  await page.getByRole('navigation', { name: 'Más' }).getByRole('link', { name: /Catálogo/ }).click()
  await expect(page).toHaveURL(/\/varieties\/catalog$/)

  // Edit Rosa's catalog attributes.
  await page.getByRole('button', { name: 'Editar Rosa' }).click()
  await page.getByLabel('Emoji').fill('🌹')
  await page.getByLabel('Porcentaje de índica').fill('30')
  await page.getByLabel('Aroma/sabor').fill('floral, dulce')
  await page.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByText('Catálogo guardado')).toBeVisible()
  await expect(page.getByText('30% índica · floral, dulce')).toBeVisible()

  // Edit the header and footer in Configuración → Mensaje del catálogo, then close back
  // to the catalog screen. The summary row is read-only here; a bare `getByText` would be
  // ambiguous, since the same strings also sit inside the preview on purpose.
  await page.getByRole('link', { name: 'Editar encabezado y pie' }).click()
  await expect(page).toHaveURL(/\/settings\/catalog-message$/)
  await page.getByLabel('Encabezado').fill('🌸 Catálogo de Flores del Catálogo 🌸')
  await page.getByLabel('Pie').fill('Pedidos por privado.')
  await page.getByRole('button', { name: 'Guardá el mensaje' }).click()
  await expect(page.getByText('Catálogo guardado')).toBeVisible()
  await page.getByRole('button', { name: 'Cerrar' }).click()
  await expect(page).toHaveURL(/\/varieties\/catalog$/)
  const headerFooterSummary = page.locator('.catalogo__encabezado-pie')
  await expect(headerFooterSummary).toContainText('🌸 Catálogo de Flores del Catálogo 🌸')
  await expect(headerFooterSummary).toContainText('Pedidos por privado.')
  await expect(page.getByLabel('Pie')).toHaveCount(0)

  // The API's own text is what both the preview and the clipboard must match.
  const apiText = await page.evaluate(() =>
    fetch('/catalog', { credentials: 'include' })
      .then((response) => response.json() as Promise<{ text: string | null }>)
      .then((body) => body.text),
  )
  expect(apiText).not.toBeNull()
  if (apiText === null) throw new Error('unreachable: asserted above')

  const previewText = await page.locator('.catalogo__vista-previa').textContent()
  expect(previewText).toBe(apiText.replaceAll('**', ''))

  await page.getByRole('button', { name: 'Copiar' }).click()
  await expect(page.getByText('Catálogo copiado')).toBeVisible()
  const clipboardText = await page.evaluate(() => navigator.clipboard.readText())
  expect(clipboardText).toBe(apiText)

  expect(consoleMessages).toEqual([])
})
