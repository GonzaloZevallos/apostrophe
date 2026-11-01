/**
 * Geist is bundled with the app and nothing is fetched from outside the installation
 * (plan, subtask `geist`): loading Entrar makes no request to a host other than the app's
 * own, no font file comes from anywhere but the app, and Geist is the face the page draws.
 */

import { LOGIN } from '../src/routes.js'
import { expect, test } from './fixtures.js'

test('the app loads Geist from its own origin and requests nothing from outside', async ({ page, baseURL }) => {
  const origin = new URL(baseURL ?? page.url()).origin
  const requested: string[] = []
  page.on('request', (request) => requested.push(request.url()))

  await page.goto(LOGIN)
  await page.evaluate(() => document.fonts.ready)

  const foreign = requested.filter((url) => url.startsWith('http') && new URL(url).origin !== origin)
  expect(foreign).toEqual([])
  expect(requested.filter((url) => /fonts\.(googleapis|gstatic)\.com/.test(url))).toEqual([])

  const fonts = requested.filter((url) => /\.woff2?(\?|$)/.test(url))
  expect(fonts.length).toBeGreaterThan(0)
  for (const url of fonts) expect(new URL(url).origin).toBe(origin)

  const drawn = await page.evaluate(() => {
    const family = getComputedStyle(document.body).fontFamily
    return { family, loaded: document.fonts.check('400 16px Geist', 'apostrophe') }
  })
  expect(drawn.family).toMatch(/^"?Geist"?,/)
  expect(drawn.loaded).toBe(true)
})
