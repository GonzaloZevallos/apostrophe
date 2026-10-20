/// <reference lib="dom" />
/**
 * The pinned-catalog task's own end-to-end run (plan, "Front", "End to end"; PRD
 * metric 6, "No curl"): a seller finds Publish disabled on the catalog screen, follows
 * its link to Configuración → Integraciones, enters the bot's token and own chat, runs
 * Send me a test, adds the channel chat, tests it too, then publishes from the catalog screen —
 * all through the built front, against the real backend wired to `FakeTelegram`
 * (`tests/e2e_app.py::create_e2e_app`, this config's own `webServer`), never a real
 * Telegram token or the network.
 */

import { CATALOG, HOME, SETTINGS_INTEGRATIONS, VARIETIES } from '../src/routes.js'
import { expectPath } from './helpers/url.js'
import { expect, test } from './fixtures.js'
import { signUpNewBusiness } from './helpers/signup.js'
import { watchConsole } from './console.js'
import { openCatalog } from './helpers/openMas.js'
import { uniqueTag } from './helpers/unique.js'

const TOKEN = '123456:fake-token-for-e2e'
// The e2e bot's one started chat (`tests/e2e_app.py`): Buscar mi chat finds it.
const STARTED_CHAT = '111111'

test.use({ isMobile: true, hasTouch: true, viewport: { width: 375, height: 812 } })

test('a seller sets up the bot in Integraciones, then publishes from the catalog screen', async ({
  page,
}) => {
  const consoleMessages: string[] = []
  watchConsole(page, consoleMessages)

  const ownerEmail = `duena-bot-${uniqueTag()}@example.com`
  const businessName = `Flores del Bot ${uniqueTag()}`

  await signUpNewBusiness(page, { businessName, email: ownerEmail })
  await expect(page.locator('.encabezado__negocio')).toHaveText(businessName)

  // A variety with a price, so the catalog has something to publish.
  await page.goto(VARIETIES)
  await page.getByRole('link', { name: 'New variety' }).click()
  await page.getByLabel('Name').fill('Rosa')
  await page.getByRole('button', { name: 'Add variety' }).click()
  await expect(page.getByText('Variety saved')).toBeVisible()
  await page.getByRole('link', { name: /Rosa/ }).click()
  await page.getByRole('link', { name: 'New price' }).click()
  await page.getByLabel(/^List price/).fill('9000')
  await page.getByRole('button', { name: 'Save price' }).click()
  await expect(page.getByText('Price saved')).toBeVisible()

  await openCatalog(page)
  await expectPath(page, CATALOG)

  // The catalog screen has no bot settings; with no bot yet, Publish is disabled and
  // says where to go. No pin yet, so it shows no status either.
  await expect(page.getByLabel('Bot token')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Publish' })).toBeDisabled()
  await expect(page.getByText('Up to date')).toHaveCount(0)
  await expect(page.getByText('Out of date')).toHaveCount(0)
  await page.getByRole('link', { name: 'Integrations' }).click()
  await expectPath(page, SETTINGS_INTEGRATIONS)

  // Enter the token and the seller's own chat; the channel is still blank, which
  // Send me a test allows (PRD, "Send me a test": "The channel chat may be blank").
  await expect(page.getByRole('button', { name: 'Find my chat' })).toBeDisabled()
  await expect(page.getByText('Enter the token first')).toBeVisible()
  await page.getByLabel('Bot token').fill(TOKEN)
  await expect(page.getByRole('button', { name: 'Find my chat' })).toBeEnabled()

  // A chat that never pressed Iniciar: Send me a test says so, in the seller's words, and keeps
  // everything typed.
  await page.getByLabel('Your chat').fill('222222')
  await page.getByRole('button', { name: 'Send me a test' }).click()
  await expect(page.getByRole('alert')).toHaveText(
    'Open your bot in Telegram and tap Start, then send the test again.',
  )
  await expect(page.getByText("The bot can't post in the channel")).toHaveCount(0)
  await expect(page.getByLabel('Bot token')).toHaveValue(TOKEN)
  await expect(page.getByLabel('Your chat')).toHaveValue('222222')

  // Buscar mi chat finds the one person who wrote to the bot and fills the number in,
  // replacing the wrong one; nothing is saved yet.
  await page.getByRole('button', { name: 'Find my chat' }).click()
  await expect(page.getByLabel('Your chat')).toHaveValue(STARTED_CHAT)
  await expect(page.getByRole('alert')).toHaveCount(0)
  await expect(page.getByText('Saved on')).toHaveCount(0)

  await page.getByRole('button', { name: 'Send me a test' }).click()
  await expect(page.getByText('Test sent')).toBeVisible()
  await expect(page.getByText('Saved on')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Publish' })).toHaveCount(0)

  // Now the channel chat, tested again.
  // The first toast may still be on screen, so wait for this attempt's own answer.
  await page.getByLabel('Channel chat').fill('@la_huerta_canal')
  const tested = page.waitForResponse(
    (response) => response.url().endsWith('/pinned-catalog/test') && response.ok(),
  )
  await page.getByRole('button', { name: 'Send me a test' }).click()
  await tested
  await expect(page.getByText('Test sent')).toBeVisible()

  // Everything is saved, so leaving asks nothing: the link leads to the catalog screen.
  await page.getByRole('link', { name: 'Go to the catalog' }).click()
  await expectPath(page, CATALOG)
  await expect(page.getByRole('button', { name: 'Publish' })).toBeEnabled()

  await page.getByRole('button', { name: 'Publish' }).click()
  await expect(page.getByText('Catalog published')).toBeVisible()
  await expect(page.getByText('Up to date')).toBeVisible()

  await page.goto(HOME)
  await expect(page.getByText('Your Telegram catalog is out of date')).toHaveCount(0)

  // The refused Send me a test answers 422, and Chromium logs every failed resource load by
  // itself; that one line carries no data, so it is excluded by exact text.
  const REFUSED_PROBARLO_NETWORK_LOG =
    'error: Failed to load resource: the server responded with a status of 422 (Unprocessable Content)'
  expect(consoleMessages.filter((message) => message !== REFUSED_PROBARLO_NETWORK_LOG)).toEqual([])

  // No token and no number found in the browser's storage.
  const stored = await page.evaluate(() =>
    JSON.stringify([{ ...localStorage }, { ...sessionStorage }]),
  )
  expect(stored).not.toContain(TOKEN)
  expect(stored).not.toContain(STARTED_CHAT)
})
