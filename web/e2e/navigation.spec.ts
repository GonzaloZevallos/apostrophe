/**
 * The navigation redesign through the served build (GH-59, "entry-points-and-e2e"):
 * - **tap budget**, counted from each tab root at a phone and a computer viewport:
 *   the sale form in 1 tap; the catalog screen, the stock entry form, the expense
 *   form and Configuración in at most 2; Registrar cobro no worse than before
 *   (Clientes → the customer's card → "Registrar cobro", one tap more from any other
 *   root for the Clientes tab);
 * - **saved links**: a reload of every old Spanish path of `LEGACY_REDIRECTS`, and of
 *   `/sales/{id}`, against the real build lands on the right screen — which proves
 *   `NavigationFallback` with a real browser, not a jsdom router;
 * - the bar at 320 px with the labels' text at 130 % shows every label whole;
 * - the bar and the sidebar switch at 900 px.
 *
 * Every route comes from `paths` or `LEGACY_REDIRECTS`, never a literal.
 */

import { expect, test, type Page } from '@playwright/test'
import { LEGACY_REDIRECTS } from '../src/routes/legacy.js'
import { paths } from '../src/routes/paths.js'
import { newBusinessInvitationUrl } from './backend.js'
import { watchConsole } from './console.js'
import { fillSaleLine } from './helpers/sale.js'
import { endsWith } from './helpers/urls.js'

const PASSWORD = 'correcthorsebattery'
const PHONE = { width: 390, height: 844 }
const COMPUTER = { width: 1280, height: 900 }

interface Seed {
  saleId: string
  customerId: string
  varietyId: string
  entryId: string
  businessName: string
}

function idFrom(url: string, build: (id: string) => string): string {
  const pathname = new URL(url).pathname
  const [before, after] = build('\u0000').split('\u0000')
  return pathname.slice((before ?? '').length, pathname.length - (after ?? '').length)
}

/** A new business with one priced variety, a stock entry, and a customer who owes. */
async function seed(page: Page): Promise<Seed> {
  const businessName = `Flores del Norte ${Date.now()}`
  await page.goto(newBusinessInvitationUrl())
  await page.getByLabel('Nombre del negocio').fill(businessName)
  await page.getByLabel('Email').fill(`duena-nav-${Date.now()}@example.com`)
  await page.getByLabel('Contraseña').fill(PASSWORD)
  await page.getByRole('button', { name: 'Creá el negocio' }).click()
  await expect(page.locator('.encabezado__negocio')).toHaveText(businessName)

  await page.goto(paths.varieties())
  await page.getByRole('button', { name: 'Nueva variedad' }).click()
  await page.getByLabel('Nombre').fill('Rosa')
  await page.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByText('Variedad guardada')).toBeVisible()
  await page.getByRole('link', { name: /Rosa/ }).click()
  await expect(page).toHaveURL(new RegExp(paths.variety('\\d+')))
  const varietyId = idFrom(page.url(), paths.variety)
  await page.getByRole('button', { name: 'Nuevo precio' }).click()
  await page.getByLabel('Precio de lista').fill('1000')
  await page.getByRole('button', { name: 'Guardar precio' }).click()
  await expect(page.getByText('Precio guardado')).toBeVisible()

  await page.goto(paths.newEntry())
  await page.getByLabel('Gramos').fill('50')
  await page.getByLabel('Variedad').selectOption({ label: 'Rosa' })
  await page.getByLabel('Costo total').fill('45000')
  await page.getByRole('button', { name: 'Guardá la entrada' }).click()
  await expect(page.getByText('Entrada guardada')).toBeVisible()
  await page.getByText('Rosa · 50 g').click()
  await expect(page).toHaveURL(new RegExp(paths.entry('\\d+')))
  const entryId = idFrom(page.url(), paths.entry)

  await page.goto(paths.newCustomer())
  await page.getByLabel('Teléfono').fill('+5491155550077')
  await page.getByLabel('Nombre').fill('Carla Pérez')
  await page.getByRole('button', { name: 'Guardá y usá' }).click()
  await expect(page).toHaveURL(endsWith(paths.customers()))
  await page.getByRole('link', { name: 'Carla Pérez' }).click()
  await expect(page).toHaveURL(new RegExp(paths.customer('\\d+')))
  const customerId = idFrom(page.url(), paths.customer)

  await page.getByRole('link', { name: 'Nueva venta a Carla Pérez' }).click()
  await fillSaleLine(page, 1, { variety: 'Rosa', grams: '5' })
  await page.getByRole('radio', { name: 'Debiendo' }).check()
  await page.getByRole('button', { name: 'Guardá la venta' }).click()
  await expect(page).toHaveURL(new RegExp(paths.sale('\\d+')))
  const saleId = idFrom(page.url(), paths.sale)

  return { saleId, customerId, varietyId, entryId, businessName }
}

type Viewport = 'phone' | 'computer'

interface Root {
  label: string
  path: string
}

const PHONE_ROOTS: Root[] = [
  { label: 'Inicio', path: paths.home() },
  { label: 'Ventas', path: paths.sales() },
  { label: 'Clientes', path: paths.customers() },
  { label: 'Variedades', path: paths.varieties() },
  { label: 'Más', path: paths.more() },
]

const COMPUTER_ROOTS: Root[] = [
  ...PHONE_ROOTS.filter((root) => root.label !== 'Más'),
  { label: 'Gastos', path: paths.expenses() },
  { label: 'Análisis', path: paths.analysis() },
]

/** Counts a tap: every click in the budget goes through here. */
class Taps {
  count = 0
  private readonly page: Page
  constructor(page: Page) {
    this.page = page
  }

  async link(name: string | RegExp, scope: 'nav' | 'screen'): Promise<void> {
    const where =
      scope === 'nav' ? this.page.getByRole('navigation', { name: 'Navegación' }) : this.page.getByRole('main')
    await where.getByRole('link', typeof name === 'string' ? { name, exact: true } : { name }).click()
    this.count += 1
  }

  async button(name: string): Promise<void> {
    await this.page.getByRole('button', { name, exact: true }).click()
    this.count += 1
  }

  /** The tab, unless the screen already is that tab's root. */
  async tab(root: Root, target: string): Promise<void> {
    if (root.label !== target) await this.link(target, 'nav')
  }
}

for (const [viewportName, viewport, roots] of [
  ['phone', PHONE, PHONE_ROOTS],
  ['computer', COMPUTER, COMPUTER_ROOTS],
] as const) {
  test.describe(`tap budget at the ${viewportName} viewport`, () => {
    test.use({ viewport })

    test(`counted from each tab root`, async ({ page }) => {
      const consoleMessages: string[] = []
      watchConsole(page, consoleMessages)
      await seed(page)
      const name: Viewport = viewportName

      for (const root of roots) {
        const taps = new Taps(page)
        const open = async () => {
          await page.goto(root.path)
          await expect(page.getByRole('navigation', { name: 'Navegación' })).toBeVisible()
          taps.count = 0
        }

        // The sale form: 1 tap, from every tab root.
        await open()
        await page.getByRole('link', { name: 'Nueva venta', exact: true }).click()
        taps.count += 1
        await expect(page).toHaveURL(endsWith(paths.newSale()))
        expect(taps.count, `sale form from ${root.label}`).toBe(1)

        // The catalog screen: Variedades → "Mandar catálogo".
        await open()
        await taps.tab(root, 'Variedades')
        await taps.link('Mandar catálogo', 'screen')
        await expect(page).toHaveURL(endsWith(paths.catalog()))
        expect(taps.count, `catalog from ${root.label}`).toBeLessThanOrEqual(2)

        // The stock entry form: Variedades → "+ Entrada de stock".
        await open()
        await taps.tab(root, 'Variedades')
        await taps.link('+ Entrada de stock', 'screen')
        await expect(page).toHaveURL(endsWith(paths.newEntry()))
        expect(taps.count, `stock entry from ${root.label}`).toBeLessThanOrEqual(2)

        // The expense form: Más → "+ Cargar gasto" on the phone; Gastos → "Nuevo gasto"
        // on a computer, which has no Más.
        await open()
        if (name === 'phone') {
          await taps.tab(root, 'Más')
          await taps.link(/^\+ Cargar gasto/, 'screen')
          await expect(page).toHaveURL(endsWith(paths.newExpense()))
        } else {
          await taps.tab(root, 'Gastos')
          await taps.button('Nuevo gasto')
          await expect(page.getByLabel('Monto')).toBeVisible()
        }
        expect(taps.count, `expense form from ${root.label}`).toBeLessThanOrEqual(2)

        // Configuración: Más → Configuración on the phone, the business row on a computer.
        await open()
        if (name === 'phone') {
          await taps.tab(root, 'Más')
          await taps.link(/^Configuración/, 'screen')
        } else {
          await page.getByRole('link', { name: /^Configuración de / }).click()
          taps.count += 1
        }
        await expect(page).toHaveURL(endsWith(paths.settings()))
        expect(taps.count, `Configuración from ${root.label}`).toBeLessThanOrEqual(2)

        // Registrar cobro, no worse than before: Clientes → the card → "Registrar cobro".
        await open()
        await taps.tab(root, 'Clientes')
        await taps.link(/^Carla Pérez/, 'screen')
        await taps.button('Registrar cobro')
        await expect(page.getByRole('button', { name: 'Cerrar' })).toBeVisible()
        expect(taps.count, `Registrar cobro from ${root.label}`).toBeLessThanOrEqual(
          root.label === 'Clientes' ? 2 : 3,
        )
      }
      expect(consoleMessages).toEqual([])
    })
  })
}

test('/settings marks Más on the phone', async ({ page }) => {
  await page.setViewportSize(PHONE)
  await seed(page)

  await page.goto(paths.settings())
  const bar = page.getByRole('navigation', { name: 'Navegación' })
  await expect(bar.getByRole('link', { name: 'Más' })).toHaveAttribute('aria-current', 'page')
})

test('saved links: a reload of every old Spanish path and of a sale lands on its screen', async ({
  page,
}) => {
  const consoleMessages: string[] = []
  watchConsole(page, consoleMessages)
  const { saleId, customerId, varietyId, entryId } = await seed(page)

  const idOf = (probe: string): string => {
    if (probe === paths.sale('ID') || probe === paths.customer('ID') || probe === paths.editCustomer('ID')) {
      return probe === paths.sale('ID') ? saleId : customerId
    }
    if (probe === paths.variety('ID')) return varietyId
    if (probe === paths.entry('ID')) return entryId
    return ''
  }

  for (const [oldPath, target] of Object.entries(LEGACY_REDIRECTS)) {
    const id = idOf(target('ID'))
    const expected = target(id)
    await page.goto(`${oldPath.replace(':id', id)}?desde=guardado`)
    await expect(page, `${oldPath} redirects`).toHaveURL(`${new URL(page.url()).origin}${expected}?desde=guardado`)
    await expect(page.getByRole('main')).toBeVisible()
    await expect(page.getByText('Eso ya no está.')).toHaveCount(0)
  }

  // A reload of the new route itself: the server answers `index.html` to a browser
  // navigation, and the sale's own screen shows.
  await page.goto(paths.sale(saleId))
  await page.reload()
  await expect(page).toHaveURL(endsWith(paths.sale(saleId)))
  await expect(page.getByRole('link', { name: 'Volver a Ventas' })).toBeVisible()
  await expect(page.getByText('Eso ya no está.')).toHaveCount(0)
  expect(consoleMessages).toEqual([])
})

test('the bar at 320 px with text at 130 % shows every label whole', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 })
  await seed(page)
  await page.goto(paths.home())
  // 130 % of the labels' 11 px.
  await page.addStyleTag({ content: '.bar-inferior__item span { font-size: 14.3px !important }' })

  const bar = page.getByRole('navigation', { name: 'Navegación' })
  const links = bar.getByRole('link')
  await expect(links).toHaveText(['Inicio', 'Ventas', 'Clientes', 'Variedades', 'Más'])

  let previousRight = 0
  for (const link of await links.all()) {
    const label = link.locator('span')
    const box = await link.boundingBox()
    const labelBox = await label.boundingBox()
    if (box === null || labelBox === null) throw new Error('a bar entry has no box')
    expect(box.x).toBeGreaterThanOrEqual(previousRight - 0.5)
    expect(box.x + box.width).toBeLessThanOrEqual(320)
    expect(labelBox.x).toBeGreaterThanOrEqual(box.x - 0.5)
    expect(labelBox.x + labelBox.width).toBeLessThanOrEqual(box.x + box.width + 0.5)
    expect(await label.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true)
    previousRight = box.x + box.width
  }
})

test('the bar and the sidebar switch at 900 px', async ({ page }) => {
  await seed(page)
  await page.goto(paths.home())

  // Only the bar has Más; only the sidebar has Análisis.
  await page.setViewportSize({ width: 899, height: 800 })
  const nav = page.getByRole('navigation', { name: 'Navegación' })
  await expect(nav.getByRole('link', { name: 'Más' })).toBeVisible()
  await expect(nav.getByRole('link', { name: 'Análisis' })).toHaveCount(0)

  await page.setViewportSize({ width: 900, height: 800 })
  await expect(nav.getByRole('link', { name: 'Análisis' })).toBeVisible()
  await expect(nav.getByRole('link', { name: 'Más' })).toHaveCount(0)
})
