/**
 * The installed shell's document against the built front (plan, subtask
 * `shell-document`, seam 3; accounts.md criterion 35): the manifest and every icon
 * it names are served at their declared size, and Chrome's own installability check,
 * on localhost, finds nothing wrong. `watchConsole` is asserted empty as every spec does.
 */

import { expect, test } from '@playwright/test'
import { watchConsole } from './console.js'

interface ManifestIcon {
  src: string
  sizes: string
  purpose?: string
}

test('the manifest and its icons are served at their declared size, and the app is installable', async ({
  page,
}) => {
  const messages: string[] = []
  watchConsole(page, messages)
  await page.goto('/entrar')

  const response = await page.request.get('/manifest.webmanifest')
  expect(response.status()).toBe(200)
  const manifest = (await response.json()) as { icons: ManifestIcon[] }
  expect(manifest.icons.length).toBeGreaterThanOrEqual(3)
  expect(manifest.icons.some((icon) => icon.sizes === '512x512' && icon.purpose === 'maskable')).toBe(true)

  for (const icon of manifest.icons) {
    const [width, height] = icon.sizes.split('x').map(Number)
    expect((await page.request.get(icon.src)).status()).toBe(200)
    const natural = await page.evaluate(
      (src) =>
        new Promise<{ width: number; height: number }>((resolve, reject) => {
          const image = new Image()
          image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight })
          image.onerror = () => reject(new Error('icon failed to load'))
          image.src = src
        }),
      icon.src,
    )
    expect(natural).toEqual({ width, height })
  }

  const session = await page.context().newCDPSession(page)
  const { installabilityErrors } = (await session.send('Page.getInstallabilityErrors')) as {
    installabilityErrors: unknown[]
  }
  expect(installabilityErrors).toEqual([])
  expect(messages).toEqual([])
})
