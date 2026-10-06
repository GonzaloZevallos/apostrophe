/// <reference lib="dom" />
/**
 * Copiar on a genuinely insecure origin (review finding, carried from the clipboard
 * subtask: "the plain-http execCommand path is proven only in jsdom with stubbed
 * globals"; plan, "Clipboard over plain http" — the home network serves the app over
 * plain http, ADR-0002, and a phone browser there treats the page as insecure and
 * withholds `navigator.clipboard` entirely).
 *
 * `127.0.0.1` (every other e2e spec's base URL) is the one carve-out in the
 * platform's own secure-context rule, so it cannot prove this path; this spec runs
 * against `http://apostrophe.test` instead, a host that is not localhost and not
 * https, so `window.isSecureContext` reads `false` there exactly as it would on a
 * seller's home network.
 *
 * `apostrophe.test` needs no real DNS entry or `/etc/hosts` edit: `page.route`
 * intercepts every request *before* the browser would resolve or connect to it and
 * answers it itself, having fetched the real response from the real backend
 * (`route.fetch`/`route.fulfill`) — the interception happens in the browser's
 * network stack, so the renderer never actually attempts a connection to the fake
 * host. The backend sees ordinary requests to `127.0.0.1`; the page only ever
 * believes it is talking to `apostrophe.test`.
 *
 * Verification doesn't read the OS clipboard back: `navigator.clipboard` does not
 * exist at all on an insecure origin (its very existence is secure-context gated),
 * so there is nothing to call `readText()` on, and headless Chromium's OS-level
 * clipboard is not reliably available without a secure context either. Instead this
 * spies on `document.execCommand` itself (installed before any app code runs, via
 * `addInitScript`) and records the hidden textarea's value at the moment of the
 * `'copy'` call — proving the exact string `clipboard.ts`'s fallback handed the
 * browser, which is what the PRD's "the clipboard equals the API's text" asks for
 * here just as directly as reading the clipboard back would.
 */

import { expect, test } from '@playwright/test'
import { e2eBaseUrl } from './env.js'
import { paths } from '../src/routes/paths.js'
import { newBusinessInvitationUrl } from './backend.js'

const PASSWORD = 'correcthorsebattery'
const INSECURE_ORIGIN = 'http://apostrophe.test'

interface ExecCommandSpy {
  __copiedViaExecCommand: string[]
}

test('Copiar still works through the execCommand fallback on a plain-http, non-localhost origin', async ({
  page,
}) => {
  await page.route('**/*', async (route) => {
    const requested = new URL(route.request().url())
    const target = new URL(requested.pathname + requested.search, e2eBaseUrl())
    const response = await route.fetch({ url: target.toString() })
    await route.fulfill({ response })
  })

  await page.addInitScript(() => {
    const copied: string[] = []
    ;(window as unknown as { __copiedViaExecCommand: string[] }).__copiedViaExecCommand = copied
    const original = document.execCommand.bind(document)
    document.execCommand = (commandId: string, showUi?: boolean, value?: string): boolean => {
      if (commandId === 'copy') {
        const active = document.activeElement
        if (active instanceof HTMLTextAreaElement) copied.push(active.value)
      }
      return original(commandId, showUi, value)
    }
  })

  const ownerEmail = `duena-insegura-${Date.now()}@example.com`
  const businessName = `Flores Inseguras ${Date.now()}`
  const inviteUrl = newBusinessInvitationUrl().replace(e2eBaseUrl(), INSECURE_ORIGIN)

  await page.goto(inviteUrl)
  expect(page.url().startsWith(INSECURE_ORIGIN)).toBe(true)
  await page.getByLabel('Nombre del negocio').fill(businessName)
  await page.getByLabel('Email').fill(ownerEmail)
  await page.getByLabel('Contraseña').fill(PASSWORD)
  await page.getByRole('button', { name: 'Creá el negocio' }).click()
  await expect(page.locator('.encabezado__negocio')).toHaveText(businessName)

  expect(await page.evaluate(() => window.isSecureContext)).toBe(false)
  expect(await page.evaluate(() => typeof navigator.clipboard)).toBe('undefined')

  // A variety with a price and stock, so the catalog has something to copy.
  await page.goto(`${INSECURE_ORIGIN}${paths.varieties()}`)
  await page.getByRole('button', { name: 'Nueva variedad' }).click()
  await page.getByLabel('Nombre').fill('Rosa')
  await page.getByRole('button', { name: 'Guardar' }).click()
  await page.getByRole('link', { name: /Rosa/ }).click()
  await page.getByRole('button', { name: 'Nuevo precio' }).click()
  await page.getByLabel('Precio de lista').fill('9000')
  await page.getByRole('button', { name: 'Guardar precio' }).click()
  await expect(page.getByText('Precio guardado')).toBeVisible()

  await page.goto(`${INSECURE_ORIGIN}${paths.newEntry()}`)
  await page.getByLabel('Gramos').fill('50')
  await page.getByLabel('Variedad').selectOption({ label: 'Rosa' })
  await page.getByLabel('Costo total').fill('45000')
  await page.getByRole('button', { name: 'Guardá la entrada' }).click()
  await expect(page.getByText('Entrada guardada')).toBeVisible()

  await page.goto(`${INSECURE_ORIGIN}${paths.catalog()}`)
  const apiText = await page.evaluate(() =>
    fetch('/catalog', { credentials: 'include' })
      .then((response) => response.json() as Promise<{ text: string | null }>)
      .then((body) => body.text),
  )
  expect(apiText).not.toBeNull()

  await page.getByRole('button', { name: 'Copiar' }).click()
  await expect(page.getByText('Catálogo copiado')).toBeVisible()

  const copied = await page.evaluate(
    () => (window as unknown as ExecCommandSpy).__copiedViaExecCommand,
  )
  expect(copied).toEqual([apiText])
})
