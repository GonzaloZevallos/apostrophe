/**
 * The phone's confirmation layer in a real phone browser (GH-1065): on the pinned fixture's
 * owing sale, "Delete sale" asks over the bottom bar. Both answers are what a tap at their centre
 * reaches and at least 44 px tall, a swipe on the scrim never moves the page behind, and
 * answering "No" leaves the page where it was. Four sizes (320, 375, 430 and 246 CSS px, which is
 * 320 at 130 %), light and dark, in the phone check's own project and server.
 */

import { readFileSync } from 'node:fs'
import { expect, test, type CDPSession, type Page } from '@playwright/test'
import { MOBILE_FACTS_FILE, MOBILE_STATE_FILE } from './env.js'
import { newCell, SIZES, THEMES, viewportOf } from './mobile/cells.js'
import { guardWrites } from './mobile/network.js'
import { settle } from './mobile/walk.js'
import { parseFacts } from '../src/mobile-standard/registry.ts'
import { SALE } from '../src/routes.ts'

const TOUCH = 44
/** Page scroll the case needs before the confirmation opens; the viewport is lowered to get it. */
const MIN_SCROLL = 60

const scrollY = (page: Page): Promise<number> => page.evaluate(() => window.scrollY)

/** True when the element at the centre of `selector` is that element or one of its descendants. */
async function reachedAtCentre(page: Page, name: string): Promise<{ reached: boolean; height: number }> {
  return page.getByRole('button', { name, exact: true }).evaluate((button) => {
    const box = button.getBoundingClientRect()
    const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2)
    return { reached: hit !== null && button.contains(hit), height: box.height }
  })
}

/** A real touch swipe (start, moves, end) through the DevTools protocol, from `from` to `to`. */
async function swipe(client: CDPSession, from: { x: number; y: number }, to: { x: number; y: number }): Promise<void> {
  const steps = 6
  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [from] })
  for (let step = 1; step <= steps; step += 1) {
    const x = from.x + ((to.x - from.x) * step) / steps
    const y = from.y + ((to.y - from.y) * step) / steps
    await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y }] })
  }
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
}

for (const size of SIZES) {
  for (const theme of THEMES) {
    test(`Delete sale asks above the bar at ${size}, ${theme}`, async ({ browser }) => {
      const facts = parseFacts(JSON.parse(readFileSync(MOBILE_FACTS_FILE, 'utf-8')))
      const context = await newCell(browser, size, theme, MOBILE_STATE_FILE)
      await guardWrites(context)
      const page = await context.newPage()
      await page.goto(SALE.replace(':id', String(facts['owing_sale'])))
      await settle(page)

      // The page must scroll: lower the viewport until it does, so the precondition is never skipped.
      const opener = page.getByRole('button', { name: 'Delete sale', exact: true })
      await expect(opener).toBeVisible()
      let height = viewportOf(size).height
      while (
        (await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight)) < MIN_SCROLL * 2 &&
        height > 260
      ) {
        height -= 60
        await page.setViewportSize({ width: viewportOf(size).width, height })
      }
      await opener.evaluate((element) => window.scrollTo(0, element.getBoundingClientRect().top + window.scrollY - 100))
      const before = await scrollY(page)
      expect(before, 'the page is scrolled before the confirmation opens').toBeGreaterThan(MIN_SCROLL)

      // Nothing open: the layer paints nothing and takes no tap.
      const closed = await page.evaluate(() => {
        const host = document.querySelector('.confirm-layer')
        const centre = document.elementFromPoint(window.innerWidth / 2, window.innerHeight / 2)
        const box = host?.getBoundingClientRect()
        return { inside: host !== null && centre !== null && host.contains(centre), width: box?.width, height: box?.height }
      })
      expect(closed).toEqual({ inside: false, width: 0, height: 0 })

      await opener.tap()
      await expect(page.getByRole('alertdialog')).toBeVisible()
      await expect(page.locator('.confirm-layer .confirmacion')).toHaveCount(1)

      for (const name of ['No, keep it', 'Yes, delete it']) {
        const answer = await reachedAtCentre(page, name)
        expect(answer.reached, `${name} is what a tap at its centre reaches`).toBe(true)
        expect(answer.height, `${name} is at least ${TOUCH} px tall`).toBeGreaterThanOrEqual(TOUCH - 0.5)
        const inside = await page.getByRole('button', { name, exact: true }).evaluate((button) => {
          const box = button.getBoundingClientRect()
          return box.top >= 0 && box.bottom <= window.innerHeight && box.left >= 0 && box.right <= window.innerWidth
        })
        expect(inside, `${name} is inside the visible viewport`).toBe(true)
      }

      // A swipe on the scrim, above the dialog, moves nothing behind it.
      const client = await context.newCDPSession(page)
      const width = viewportOf(size).width
      await swipe(client, { x: width / 2, y: 8 }, { x: width / 2, y: 8 + 120 })
      await swipe(client, { x: width / 2, y: 130 }, { x: width / 2, y: 8 })
      expect(Math.abs((await scrollY(page)) - before)).toBeLessThanOrEqual(2)

      await page.getByRole('button', { name: 'No, keep it', exact: true }).tap()
      await expect(page.getByRole('alertdialog')).toHaveCount(0)
      expect(Math.abs((await scrollY(page)) - before)).toBeLessThanOrEqual(2)
      await context.close()
    })
  }
}
