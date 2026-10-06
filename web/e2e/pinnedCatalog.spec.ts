/// <reference lib="dom" />
/**
 * The pinned-catalog task's own end-to-end run (plan, "Front", "End to end"; PRD
 * metric 6, "No curl"): a seller enters the bot's token and own chat, runs Probarlo,
 * sees Publicar turn enabled, enters the channel chat, tests it too, then publishes —
 * all through the built front, against the real backend wired to `FakeTelegram`
 * (`tests/e2e_app.py::create_e2e_app`, this config's own `webServer`), never a real
 * Telegram token or the network.
 */

import { expect, test } from '@playwright/test'
import { paths } from '../src/routes/paths.js'
import { endsWith } from './helpers/urls.js'
import { newBusinessInvitationUrl } from './backend.js'
import { watchConsole } from './console.js'

const PASSWORD = 'correcthorsebattery'

test('a seller sets up the bot, tests it, then publishes, from the front alone', async ({
  page,
}) => {
  const consoleMessages: string[] = []
  watchConsole(page, consoleMessages)

  const ownerEmail = `duena-bot-${Date.now()}@example.com`
  const businessName = `Flores del Bot ${Date.now()}`

  await page.goto(newBusinessInvitationUrl())
  await page.getByLabel('Nombre del negocio').fill(businessName)
  await page.getByLabel('Email').fill(ownerEmail)
  await page.getByLabel('Contraseña').fill(PASSWORD)
  await page.getByRole('button', { name: 'Creá el negocio' }).click()
  await expect(page.locator('.encabezado__negocio')).toHaveText(businessName)

  // A variety with a price, so the catalog has something to publish.
  await page.goto(paths.varieties())
  await page.getByRole('button', { name: 'Nueva variedad' }).click()
  await page.getByLabel('Nombre').fill('Rosa')
  await page.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByText('Variedad guardada')).toBeVisible()
  await page.getByRole('link', { name: /Rosa/ }).click()
  await page.getByRole('button', { name: 'Nuevo precio' }).click()
  await page.getByLabel('Precio de lista').fill('9000')
  await page.getByRole('button', { name: 'Guardar precio' }).click()
  await expect(page.getByText('Precio guardado')).toBeVisible()

  await page.goto(paths.varieties())
  await page.getByRole('link', { name: 'Mandar catálogo' }).click()
  await expect(page).toHaveURL(endsWith(paths.catalog()))

  // No pin yet: Inicio shows no out-of-date line, and Catálogo shows no status.
  await expect(page.getByText('Al día')).toHaveCount(0)
  await expect(page.getByText('Desactualizado')).toHaveCount(0)

  // Enter the token and the seller's own chat; the channel is still blank, which
  // Probarlo allows (PRD, "Probarlo": "The channel chat may be blank").
  await page.getByLabel('Token', { exact: false }).fill('123456:fake-token-for-e2e')
  await page.getByLabel('Tu chat', { exact: false }).fill('111111')
  await expect(page.getByRole('button', { name: 'Publicar' })).toBeDisabled()

  await page.getByRole('button', { name: 'Probarlo' }).click()
  await expect(page.getByText('Prueba enviada')).toBeVisible()

  // Still disabled: no channel chat saved yet.
  await expect(page.getByRole('button', { name: 'Publicar' })).toBeDisabled()

  // Now the channel chat, tested again (the gate re-arms on any of the three
  // fields changing), then Publicar turns enabled.
  await page.getByLabel('Chat del canal', { exact: false }).fill('@la_huerta_canal')
  await page.getByRole('button', { name: 'Probarlo' }).click()
  await expect(page.getByText('Prueba enviada')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Publicar' })).toBeEnabled()

  await page.getByRole('button', { name: 'Publicar' }).click()
  await expect(page.getByText('Catálogo publicado')).toBeVisible()
  await expect(page.getByText('Al día')).toBeVisible()

  await page.goto(paths.home())
  await expect(page.getByText('Tu catálogo en Telegram está desactualizado')).toHaveCount(0)

  expect(consoleMessages).toEqual([])
})
