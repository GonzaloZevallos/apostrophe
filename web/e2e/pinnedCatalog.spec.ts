/// <reference lib="dom" />
/**
 * The pinned-catalog task's own end-to-end run (plan, "Front", "End to end"; PRD
 * metric 6, "No curl"): a seller finds Publicar disabled on the catalog screen, follows
 * its link to Configuración → Integraciones, enters the bot's token and own chat, runs
 * Probarlo, adds the channel chat, tests it too, then publishes from the catalog screen —
 * all through the built front, against the real backend wired to `FakeTelegram`
 * (`tests/e2e_app.py::create_e2e_app`, this config's own `webServer`), never a real
 * Telegram token or the network.
 */

import { CATALOG, HOME, SETTINGS_INTEGRATIONS, VARIETIES } from '../src/routes.js'
import { expectPath } from './helpers/url.js'
import { expect, test } from '@playwright/test'
import { newBusinessInvitationUrl } from './backend.js'
import { watchConsole } from './console.js'
import { openMas } from './helpers/openMas.js'

const PASSWORD = 'correcthorsebattery'

test('a seller sets up the bot in Integraciones, then publishes from the catalog screen', async ({
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
  await page.goto(VARIETIES)
  await page.getByRole('button', { name: 'Nueva variedad' }).click()
  await page.getByLabel('Nombre').fill('Rosa')
  await page.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByText('Variedad guardada')).toBeVisible()
  await page.getByRole('link', { name: /Rosa/ }).click()
  await page.getByRole('button', { name: 'Nuevo precio' }).click()
  await page.getByLabel('Precio de lista').fill('9000')
  await page.getByRole('button', { name: 'Guardar precio' }).click()
  await expect(page.getByText('Precio guardado')).toBeVisible()

  await openMas(page)
  await page.getByRole('navigation', { name: 'Más' }).getByRole('link', { name: /Catálogo/ }).click()
  await expectPath(page, CATALOG)

  // The catalog screen has no bot settings; with no bot yet, Publicar is disabled and
  // says where to go. No pin yet, so it shows no status either.
  await expect(page.getByLabel('Token del bot')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Publicar' })).toBeDisabled()
  await expect(page.getByText('Al día')).toHaveCount(0)
  await expect(page.getByText('Desactualizado')).toHaveCount(0)
  await page.getByRole('link', { name: 'Integraciones' }).click()
  await expectPath(page, SETTINGS_INTEGRATIONS)

  // Enter the token and the seller's own chat; the channel is still blank, which
  // Probarlo allows (PRD, "Probarlo": "The channel chat may be blank").
  await page.getByLabel('Token del bot').fill('123456:fake-token-for-e2e')
  await page.getByLabel('Tu chat').fill('111111')
  await page.getByRole('button', { name: 'Probarlo' }).click()
  await expect(page.getByText('Prueba enviada')).toBeVisible()
  await expect(page.getByText('Guardado el')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Publicar' })).toHaveCount(0)

  // Now the channel chat, tested again.
  // The first toast may still be on screen, so wait for this attempt's own answer.
  await page.getByLabel('Chat del canal').fill('@la_huerta_canal')
  const tested = page.waitForResponse(
    (response) => response.url().endsWith('/pinned-catalog/test') && response.ok(),
  )
  await page.getByRole('button', { name: 'Probarlo' }).click()
  await tested
  await expect(page.getByText('Prueba enviada')).toBeVisible()

  // Everything is saved, so leaving asks nothing: the link leads to the catalog screen.
  await page.getByRole('link', { name: 'Ir al catálogo' }).click()
  await expectPath(page, CATALOG)
  await expect(page.getByRole('button', { name: 'Publicar' })).toBeEnabled()

  await page.getByRole('button', { name: 'Publicar' }).click()
  await expect(page.getByText('Catálogo publicado')).toBeVisible()
  await expect(page.getByText('Al día')).toBeVisible()

  await page.goto(HOME)
  await expect(page.getByText('Tu catálogo en Telegram está desactualizado')).toHaveCount(0)

  expect(consoleMessages).toEqual([])
})
