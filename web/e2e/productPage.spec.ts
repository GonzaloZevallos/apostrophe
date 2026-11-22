/**
 * The Product page in a real phone browser (GH-850): at the three phone sizes and in both themes,
 * the state block and the actions show whole without scrolling, active and archived. Reached the
 * way the seller does: tapping the Product's name in Products, and "Blue Dream" through Archived.
 * The block sits at or below the phone header's bottom (the back arrow lives there) and the
 * actions end at or above the bottom navigation's top.
 */

import { expect, test, type Page } from '@playwright/test'
import { MOBILE_STATE_FILE } from './env.js'
import { newCell, THEMES, type Theme } from './mobile/cells.js'
import { guardWrites } from './mobile/network.js'
import { settle } from './mobile/walk.js'
import { ARCHIVED_VARIETIES, VARIETIES } from '../src/routes.ts'

const SIZES = ['320x568', '375x812', '430x932'] as const

interface Margins {
  scrollY: number
  blockTop: number
  headerBottom: number
  actionsBottom: number
  navTop: number
}

/** The geometry the fit is judged on, read once the page settled. `actions` names the last action. */
async function measure(page: Page, back: string, lastAction: string): Promise<Margins> {
  const title = page.getByRole('heading', { level: 1 })
  const block = page.getByRole('main').getByRole('list').first()
  const arrow = page.getByRole('button', { name: back })
  const action = page.getByRole('main').getByRole('link', { name: lastAction }).or(page.getByRole('main').getByRole('button', { name: lastAction }))
  const nav = page.getByRole('navigation', { name: 'Navigation' })
  await expect(title).toBeVisible()
  await expect(block).toBeVisible()
  await expect(block).not.toHaveAttribute('aria-busy', 'true')
  const [blockBox, arrowBox, actionBox, navBox] = await Promise.all([
    block.boundingBox(),
    arrow.boundingBox(),
    action.first().boundingBox(),
    nav.boundingBox(),
  ])
  if (blockBox === null || arrowBox === null || actionBox === null || navBox === null) throw new Error('a measured element has no box')
  return {
    scrollY: await page.evaluate(() => window.scrollY),
    blockTop: blockBox.y,
    headerBottom: arrowBox.y + arrowBox.height,
    actionsBottom: actionBox.y + actionBox.height,
    navTop: navBox.y,
  }
}

function expectFits(margins: Margins, where: string): void {
  expect(margins.scrollY, `${where}: not scrolled`).toBe(0)
  expect(margins.blockTop, `${where}: block below the header`).toBeGreaterThanOrEqual(margins.headerBottom)
  expect(margins.actionsBottom, `${where}: actions above the bottom navigation`).toBeLessThanOrEqual(margins.navTop)
}

for (const theme of THEMES) {
  for (const size of SIZES) {
    test(`an active Product shows its block and actions without scrolling at ${size}, ${theme}`, async ({ browser }, info) => {
      const context = await newCell(browser, size, theme as Theme, MOBILE_STATE_FILE)
      await guardWrites(context)
      const page = await context.newPage()
      await page.goto(VARIETIES)
      await settle(page)
      await page.getByRole('main').getByRole('link', { name: /Golden Cookies/ }).first().click()
      await settle(page)
      const margins = await measure(page, '‹ Products', 'Take from stock')
      info.annotations.push({ type: 'margins', description: JSON.stringify(margins) })
      expectFits(margins, `active ${size} ${theme}`)
      await context.close()
    })

    test(`an archived Product shows its block and Restore without scrolling at ${size}, ${theme}`, async ({ browser }, info) => {
      const context = await newCell(browser, size, theme as Theme, MOBILE_STATE_FILE)
      await guardWrites(context)
      const page = await context.newPage()
      await page.goto(ARCHIVED_VARIETIES)
      await settle(page)
      await page.getByRole('main').getByRole('link', { name: /Blue Dream/ }).first().click()
      await settle(page)
      const margins = await measure(page, '‹ Archived', 'Restore')
      info.annotations.push({ type: 'margins', description: JSON.stringify(margins) })
      expectFits(margins, `archived ${size} ${theme}`)
      await context.close()
    })
  }
}
