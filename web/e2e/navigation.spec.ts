/**
 * Navigation against the real backend serving `web/dist` (PRD criteria 3 and 6): every path of
 * `screens.json` that is built opens the app on a browser navigation, never JSON or a 401;
 * signed out it lands on Entrar; every old Spanish path answers a permanent redirect to its
 * English route, keeping the id and the query; a gone sale shows "Eso ya no está."; an unknown
 * address goes to Inicio. Paths come from `routes.ts` and `screens.json`, never written here.
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { HOME, LEGACY_REDIRECTS, LOGIN, SALE, pathTo } from '../src/routes.js'
import { expect, test, type Page } from '@playwright/test'
import { watchConsole } from './console.js'
import { seedRecords, signUp, type Records } from './helpers/seed.js'
import { expectOnlyTheThemeStored } from './helpers/storage.js'

interface Entry {
  route: string | null
  path: string
  signed_out?: boolean
}

function hasScreens(value: unknown): value is { screens: Entry[] } {
  return typeof value === 'object' && value !== null && 'screens' in value && Array.isArray(value.screens)
}

function builtPaths(): string[] {
  const parsed: unknown = JSON.parse(readFileSync(resolve(process.cwd(), '..', 'scripts/design/screens.json'), 'utf-8'))
  if (!hasScreens(parsed)) throw new Error('screens.json has no screens')
  const paths = parsed.screens.filter((entry) => entry.route === entry.path && entry.signed_out !== true).map((entry) => entry.path)
  return [...new Set(paths)]
}

const GONE_ID = 999999
const QUERY = '?month=2026-01'

function filled(template: string, ids: Record<string, number>): string {
  return template.replace(/\{(\w+)\}/g, (_whole, name: string) => String(ids[name]))
}

function legacyId(old: string, records: Records): number {
  const first = old.split(/\//)[1]
  if (first === 'ventas') return records.sale
  if (first === 'clientes') return records.customer
  if (first === 'mi-stock') return records.entry
  return records.variety
}

async function expectAppScreen(page: Page): Promise<void> {
  await expect(page.locator('#root main').first()).toBeVisible()
  await expect(page.locator('body')).not.toHaveText(/^\s*[{[]/)
}

test.describe.serial('navigation', () => {
  let page: Page
  let records: Records
  const consoleMessages: string[] = []

  test.beforeAll(async ({ browser }) => {
    test.setTimeout(180_000)
    page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage()
    watchConsole(page, consoleMessages)
    await signUp(page, 'Rutas')
    records = await seedRecords(page, 'Carla Rutas')
  })

  test.afterAll(async () => {
    await page.context().close()
  })

  test('every built path of screens.json opens the app on a navigation, at the phone and at the computer', async () => {
    const ids = { owing_sale: records.sale, debtor: records.customer, low: records.variety }
    const paths = builtPaths()
    expect(paths.length).toBeGreaterThan(20)
    for (const size of [{ width: 390, height: 844 }, { width: 1280, height: 920 }]) {
      await page.setViewportSize(size)
      for (const template of paths) {
        const path = filled(template, ids)
        const response = await page.goto(path)
        expect(response?.status(), path).toBe(200)
        expect(response?.headers()['content-type'], path).toContain('text/html')
        expect(new URL(page.url()).pathname, path).toBe(path)
        await expectAppScreen(page)
      }
    }
  })

  for (const [old, now] of LEGACY_REDIRECTS) {
    test(`${old} answers a permanent redirect to ${now}, keeping the id and the query`, async () => {
      const id = old.includes(':id') ? legacyId(old, records) : undefined
      const from = pathTo(old, id === undefined ? {} : { id }) + QUERY
      const to = pathTo(now, id === undefined ? {} : { id })

      const raw = await page.request.fetch(from, { maxRedirects: 0, headers: { accept: 'text/html' } })
      expect(raw.status()).toBe(308)
      const location = new URL(raw.headers().location ?? '', raw.url())
      expect(location.pathname).toBe(to)
      expect(location.search).toBe(QUERY)

      await page.goto(from)
      await expect(page).toHaveURL(new RegExp(`${to.replace(/\//g, '\\/')}(\\?.*)?$`))
      await expectAppScreen(page)
    })
  }

  test('an old link to a gone sale lands on the English route and says "Eso ya no está."', async () => {
    const old = LEGACY_REDIRECTS.find(([, now]) => now === SALE)
    expect(old).toBeDefined()
    await page.goto(pathTo(old?.[0] ?? '', { id: GONE_ID }))
    expect(new URL(page.url()).pathname).toBe(pathTo(old?.[1] ?? '', { id: GONE_ID }))
    await expect(page.getByText('Eso ya no está.')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Volver a Ventas' }).or(page.getByRole('button', { name: 'Volver a Ventas' }))).toBeVisible()
  })

  test('an unknown address goes to Inicio', async () => {
    await page.goto('/no-such-screen')
    await expect(page).toHaveURL(new RegExp(`${HOME}$`))
    await expect(page.locator('.encabezado__titulo')).toHaveText('Inicio')
    // An old Spanish path with nothing behind it is no redirect row: the front's `*` takes it.
    await page.goto(`${LEGACY_REDIRECTS[0]?.[0] ?? ''}/basura`)
    await expect(page).toHaveURL(new RegExp(`${HOME}$`))
  })

  test('nothing but the theme is stored after the run, and the console stayed quiet', async () => {
    await expectOnlyTheThemeStored(page)
    expect(consoleMessages.filter((message) => !message.includes('404') && !message.includes('308'))).toEqual([])
  })

  test('signed out, every built path lands on Entrar', async ({ browser }) => {
    const ids = { owing_sale: records.sale, debtor: records.customer, low: records.variety }
    const context = await browser.newContext()
    const anonymous = await context.newPage()
    for (const template of builtPaths()) {
      await anonymous.goto(filled(template, ids))
      await expect(anonymous, template).toHaveURL(new RegExp(`${LOGIN}$`))
    }
    await context.close()
  })
})
