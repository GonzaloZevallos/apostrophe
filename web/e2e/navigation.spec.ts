/**
 * Navigation against the real backend serving `web/dist` (PRD criteria 3 and 6): every path of
 * `screens.json` that is built opens the app on a browser navigation, never JSON or a 401;
 * signed out it lands on Entrar; every old Spanish path answers a permanent redirect to its
 * English route, keeping the id and the query; a gone sale shows "That's gone."; an unknown
 * address goes to Inicio. Paths come from `routes.ts` and `screens.json`, never written here.
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { CUSTOMER, CUSTOMER_EDIT, HOME, LOGIN, SALE, STOCK_ENTRY, VARIETY, pathTo } from '../src/routes.js'
import { expect, test } from './fixtures.js'
import type { Locator, Page } from '@playwright/test'
import { watchConsole } from './console.js'
import { LEGACY_REDIRECTS } from './helpers/legacyPaths.js'
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
  return template.replace(/\{(\w+)\}/g, (_whole, name: string) => {
    const id = ids[name]
    if (id === undefined) throw new Error(`screens.json names {${name}}, which the spec has no id for`)
    return String(id)
  })
}

/** The record an old path's `:id` stands for, told by the route it moved to. */
function legacyId(now: string, records: Records): number {
  const byTarget = new Map([
    [SALE, records.sale],
    [CUSTOMER, records.customer],
    [CUSTOMER_EDIT, records.customer],
    [VARIETY, records.variety],
    [STOCK_ENTRY, records.entry],
  ])
  const id = byTarget.get(now)
  if (id === undefined) throw new Error(`no seeded record for ${now}`)
  return id
}

/** The one console message a gone or foreign record is allowed to leave: the API's own 404. */
const API_NOT_FOUND = /^error: Failed to load resource: the server responded with a status of 404/

async function expectAppScreen(page: Page): Promise<void> {
  await expect(page.locator('#root main').first()).toBeVisible()
  await expect(page.locator('body')).not.toHaveText(/^\s*[{[]/)
}

test.describe.serial('navigation', () => {
  let page: Page
  let records: Records
  const consoleMessages: string[] = []

  test.beforeAll(async ({ browser, workerServer }) => {
    test.setTimeout(180_000)
    page = await (await browser.newContext({ baseURL: workerServer.url, viewport: { width: 390, height: 844 } })).newPage()
    watchConsole(page, consoleMessages)
    await signUp(page, 'Rutas')
    records = await seedRecords(page, 'Carla Rutas')
  })

  test.afterAll(async () => {
    await page.context().close()
  })

  test('every built path of screens.json opens the app on a navigation, at the phone and at the computer', async () => {
    const ids = {
      owing_sale: records.sale,
      debtor: records.customer,
      low: records.variety,
      sold_out: records.variety,
      entry: records.entry,
      withdrawal: records.withdrawal,
    }
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
      const id = old.includes(':id') ? legacyId(now, records) : undefined
      const from = pathTo(old, id === undefined ? {} : { id }) + QUERY
      const to = pathTo(now, id === undefined ? {} : { id })

      const raw = await page.request.fetch(from, { maxRedirects: 0, headers: { accept: 'text/html' } })
      expect(raw.status()).toBe(308)
      const location = new URL(raw.headers().location ?? '', raw.url())
      expect(location.pathname).toBe(to)
      expect(location.search).toBe(QUERY)

      await page.goto(from)
      await expect(page).toHaveURL((url) => url.pathname === to && url.search === QUERY)
      await expectAppScreen(page)
    })
  }

  test('an old link to a gone sale lands on the English route and says "That\'s gone."', async () => {
    const old = LEGACY_REDIRECTS.find(([, now]) => now === SALE)
    expect(old).toBeDefined()
    await page.goto(pathTo(old?.[0] ?? '', { id: GONE_ID }))
    expect(new URL(page.url()).pathname).toBe(pathTo(old?.[1] ?? '', { id: GONE_ID }))
    await expect(page.getByText("That's gone.")).toBeVisible()
    await expect(page.getByRole('link', { name: 'Volver a Ventas' }).or(page.getByRole('button', { name: 'Volver a Ventas' }))).toBeVisible()
  })

  test("an old link to another business's sale lands on the English route and says \"That's gone.\"", async ({
    browser,
    workerServer,
  }) => {
    const old = LEGACY_REDIRECTS.find(([, now]) => now === SALE)
    expect(old).toBeDefined()
    const context = await browser.newContext({ baseURL: workerServer.url, viewport: { width: 390, height: 844 } })
    const other = await context.newPage()
    await signUp(other, 'Ajena')
    await other.goto(pathTo(old?.[0] ?? '', { id: records.sale }))
    expect(new URL(other.url()).pathname).toBe(pathTo(old?.[1] ?? '', { id: records.sale }))
    await expect(other.getByText("That's gone.")).toBeVisible()
    await expect(
      other.getByRole('link', { name: 'Volver a Ventas' }).or(other.getByRole('button', { name: 'Volver a Ventas' })),
    ).toBeVisible()
    await context.close()
  })

  test('an unknown address goes to Inicio', async () => {
    await page.goto('/no-such-screen')
    await expect(page).toHaveURL(new RegExp(`${HOME}$`))
    await expect(page.locator('.encabezado__titulo')).toHaveText('Inicio')
    // An old Spanish path with nothing behind it is no redirect row: the front's `*` takes it.
    await page.goto(`${LEGACY_REDIRECTS[0]?.[0] ?? ''}/basura`)
    await expect(page).toHaveURL(new RegExp(`${HOME}$`))
  })

  test('"Nueva venta", in every form, is drawn as an action: no underline, no link box-shadow', async ({ browser, workerServer }) => {
    // The real stylesheet in a real browser (computed style is meaningless in jsdom).
    const expectAction = async (control: Locator): Promise<void> => {
      await expect(control).toBeVisible()
      const look = await control.evaluate((element) => {
        const style = getComputedStyle(element)
        return { line: style.textDecorationLine, shadow: style.boxShadow }
      })
      expect(look.line).toBe('none')
      expect(look.shadow).not.toMatch(/\b0px 1px 0px 0px\b/)
    }

    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(HOME)
    await expectAction(page.locator('.columna-principal > .boton-nueva-venta'))

    await page.setViewportSize({ width: 1280, height: 920 })
    await page.goto(HOME)
    await expectAction(page.locator('.boton-nueva-venta--escritorio'))

    for (const size of [{ width: 390, height: 844 }, { width: 1280, height: 920 }]) {
      await page.setViewportSize(size)
      await page.goto(pathTo(CUSTOMER, { id: records.customer }))
      await expectAction(page.getByRole('link', { name: `Nueva venta a ${records.customerName}` }))
    }

    // InicioPrimeraVez: Inicio of a business with nothing in it yet.
    const context = await browser.newContext({ baseURL: workerServer.url, viewport: { width: 390, height: 844 } })
    const fresh = await context.newPage()
    await signUp(fresh, 'PrimeraVez')
    await fresh.goto(HOME)
    await expectAction(fresh.locator('.columna-principal > .boton-nueva-venta'))
    await fresh.setViewportSize({ width: 1280, height: 920 })
    await expectAction(fresh.locator('.boton-nueva-venta--escritorio'))
    await context.close()
  })

  test('nothing but the theme is stored after the run, and the console stayed quiet', async () => {
    await expectOnlyTheThemeStored(page)
    expect(consoleMessages.filter((message) => !API_NOT_FOUND.test(message))).toEqual([])
  })

  test('signed out, every built path lands on Entrar', async ({ browser, workerServer }) => {
    const ids = {
      owing_sale: records.sale,
      debtor: records.customer,
      low: records.variety,
      sold_out: records.variety,
      entry: records.entry,
      withdrawal: records.withdrawal,
    }
    const context = await browser.newContext({ baseURL: workerServer.url })
    const anonymous = await context.newPage()
    for (const template of builtPaths()) {
      await anonymous.goto(filled(template, ids))
      await expect(anonymous, template).toHaveURL(new RegExp(`${LOGIN}$`))
    }
    await context.close()
  })
})
