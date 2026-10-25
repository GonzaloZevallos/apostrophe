/**
 * The phone's fixed chrome and the keyboard, in a real browser (GH-319, "Fixed bar, floating
 * + New sale, toasts"): at 320, 360 and 390 px the bar and "+ New sale" stay inside the viewport at
 * the top, middle and bottom of every tab root, with the last row above them; a card keeps the bar
 * and has no button; a form has neither. On Customers, a keyboard (a lowered viewport with the
 * search focused) hides both, and bringing the height back returns them with the typed text and
 * the scroll position unchanged. An Android-sized scroll keeps the bar in view.
 */

import { ANALYSIS, CUSTOMERS, EXPENSES, HOME, MORE, SALE_NEW, SALES, VARIETIES } from '../src/routes.js'
import { expect, test } from './fixtures.js'
import type { Page } from '@playwright/test'
import { signUpNewBusiness } from './helpers/signup.js'
import { uniqueTag } from './helpers/unique.js'

const WIDTHS = [320, 360, 390] as const
const HEIGHT = 560

interface Edges {
  bar: { top: number; bottom: number } | null
  button: { top: number; bottom: number } | null
  /** The top of the floating group: its missing line when there is one, else the button. */
  groupTop: number | null
  lastRowBottom: number
  viewport: number
}

async function edges(page: Page): Promise<Edges> {
  return page.evaluate(() => {
    const box = (selector: string) => {
      const element = document.querySelector(selector)
      if (element === null) return null
      const { top, bottom } = element.getBoundingClientRect()
      return { top, bottom }
    }
    const group = box('.nueva-venta-flotante > *')
    const children = [...document.querySelectorAll('.columna-principal *')].filter(
      (element) =>
        element.closest('.bar-inferior, .nueva-venta-flotante') === null &&
        element.children.length === 0 &&
        element.getBoundingClientRect().height > 0,
    )
    return {
      bar: box('.bar-inferior'),
      button: box('a.boton-nueva-venta'),
      groupTop: group === null ? null : group.top,
      lastRowBottom: Math.max(0, ...children.map((element) => element.getBoundingClientRect().bottom)),
      viewport: window.innerHeight,
    }
  })
}

async function scrollTo(page: Page, where: 'top' | 'middle' | 'bottom'): Promise<void> {
  await page.evaluate((at) => {
    const room = document.documentElement.scrollHeight - window.innerHeight
    window.scrollTo(0, at === 'top' ? 0 : at === 'middle' ? room / 2 : room)
  }, where)
}

test('the bar and the button stay in view on every root, the last row above them; a card has only the bar and a form neither', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: HEIGHT })
  await signUpNewBusiness(page, {
    businessName: `Flores Fijas ${uniqueTag()}`,
    email: `duena-fijas-${uniqueTag()}@example.com`,
  })

  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: HEIGHT })
    for (const root of [HOME, SALES, CUSTOMERS, VARIETIES, EXPENSES, ANALYSIS, MORE]) {
      await page.goto(root)
      await expect(page.locator('.bar-inferior')).toBeVisible()
      for (const where of ['top', 'middle', 'bottom'] as const) {
        await scrollTo(page, where)
        const found = await edges(page)
        const at = `${root} at ${width}, ${where}`
        expect(found.bar, `${at}: bar`).not.toBeNull()
        expect(found.bar?.top ?? -1, `${at}: bar top`).toBeGreaterThanOrEqual(0)
        expect(found.bar?.bottom ?? Infinity, `${at}: bar bottom`).toBeLessThanOrEqual(found.viewport)
        if (found.button !== null) {
          expect(found.button.top, `${at}: button top`).toBeGreaterThanOrEqual(0)
          expect(found.button.bottom, `${at}: button above the bar`).toBeLessThanOrEqual(found.bar?.top ?? 0)
        }
      }
      await scrollTo(page, 'bottom')
      const end = await edges(page)
      expect(end.lastRowBottom, `${root} at ${width}: last row above the chrome`).toBeLessThanOrEqual(
        (end.groupTop ?? end.bar?.top ?? 0) + 0.5,
      )
    }
  }

  await page.setViewportSize({ width: 360, height: HEIGHT })
  await page.goto(SALE_NEW)
  await expect(page.locator('.encabezado-fila')).toBeVisible()
  await expect(page.locator('.bar-inferior')).toHaveCount(0)
  await expect(page.locator('a.boton-nueva-venta')).toHaveCount(0)
})

test('on Customers a keyboard hides the bar and the button; they come back with the text and the scroll as they were', async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 700 })
  await signUpNewBusiness(page, {
    businessName: `Flores Teclado ${uniqueTag()}`,
    email: `duena-teclado-${uniqueTag()}@example.com`,
  })
  await page.goto(CUSTOMERS)
  const search = page.getByRole('searchbox').or(page.getByRole('textbox')).first()
  await expect(search).toBeVisible()
  await search.fill('Ana')
  await search.focus()
  const scrollY = await page.evaluate(() => window.scrollY)

  // The keyboard takes room: the viewport shrinks by more than 120 px with the field focused.
  await page.setViewportSize({ width: 360, height: 400 })
  await expect(page.locator('.disposicion')).toHaveAttribute('data-teclado', 'abierto')
  await expect(page.locator('.bar-inferior')).toBeHidden()
  await expect(page.locator('a.boton-nueva-venta')).toBeHidden()

  await search.blur()
  await page.setViewportSize({ width: 360, height: 700 })
  await expect(page.locator('.disposicion')).not.toHaveAttribute('data-teclado', 'abierto')
  await expect(page.locator('.bar-inferior')).toBeVisible()
  await expect(page.locator('a.boton-nueva-venta')).toBeVisible()
  await expect(search).toHaveValue('Ana')
  expect(await page.evaluate(() => window.scrollY)).toBe(scrollY)
})

test('scrolling an Android-sized viewport keeps the bar visible', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 })
  await signUpNewBusiness(page, {
    businessName: `Flores Android ${uniqueTag()}`,
    email: `duena-android-${uniqueTag()}@example.com`,
  })
  await page.goto(HOME)
  for (const where of ['middle', 'bottom', 'top'] as const) {
    await scrollTo(page, where)
    const found = await edges(page)
    expect(found.bar?.bottom ?? Infinity, `bar at ${where}`).toBeLessThanOrEqual(found.viewport)
    await expect(page.locator('.bar-inferior')).toBeInViewport()
  }
})
