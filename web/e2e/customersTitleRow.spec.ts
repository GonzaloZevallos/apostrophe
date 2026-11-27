/**
 * The Customers title row on a phone (GH-1071, D-8ecb8c1d): the title, the neutral round "+"
 * ("New customer") and the avatar share one line and stay inside the screen, measured in a real
 * browser because jsdom lays nothing out. At 246 px the title may be cut (the last resort); at
 * 320 and 375 px, in English, it is whole. 899 px is the widest phone layout: there is no second
 * breakpoint, so the round "+" is drawn up to it.
 */

import { expect, test } from './fixtures.js'
import type { Page } from '@playwright/test'
import { PHONE_CONTEXT, TOLERANCE } from './helpers/textScale.js'
import { signUpNewBusiness } from './helpers/signup.js'
import { CUSTOMERS } from '../src/routes.js'

const HEIGHT = 700
const WIDTHS = [246, 320, 375, 899]
const WHOLE_TITLE_WIDTHS = [320, 375]

test.use(PHONE_CONTEXT)

interface Row {
  addTop: number
  avatarTop: number
  addRight: number
  avatarRight: number
  addWidth: number
  titleWhole: boolean
  pageWidth: number
  viewport: number
}

async function measureRow(page: Page): Promise<Row> {
  const add = page.getByRole('link', { name: 'New customer' })
  const avatar = page.getByRole('link', { name: 'Settings' })
  const title = page.getByRole('main').getByText('Customers', { exact: true })
  await expect(add).toHaveCount(1)
  await expect(avatar).toBeVisible()
  const [addBox, avatarBox] = await Promise.all([add.boundingBox(), avatar.boundingBox()])
  if (addBox === null || avatarBox === null) throw new Error('the row is not drawn')
  const titleWhole = await title.evaluate((node) => node.scrollWidth <= node.clientWidth)
  const { pageWidth, viewport } = await page.evaluate(() => ({
    pageWidth: document.documentElement.scrollWidth,
    viewport: window.innerWidth,
  }))
  return {
    addTop: addBox.y,
    avatarTop: avatarBox.y,
    addRight: addBox.x + addBox.width,
    avatarRight: avatarBox.x + avatarBox.width,
    addWidth: addBox.width,
    titleWhole,
    pageWidth,
    viewport,
  }
}

test.describe.serial('the Customers title row on a phone', () => {
  let page: Page

  test.beforeAll(async ({ browser, workerServer }) => {
    page = await (
      await browser.newContext({ ...PHONE_CONTEXT, baseURL: workerServer.url, viewport: { width: 320, height: HEIGHT } })
    ).newPage()
    await signUpNewBusiness(page)
  })

  test.afterAll(async () => {
    await page.context().close()
  })

  for (const width of WIDTHS) {
    test(`at ${width} px the "+" and the avatar share one line and nothing passes the screen`, async () => {
      await page.setViewportSize({ width, height: HEIGHT })
      await page.goto(CUSTOMERS)
      const row = await measureRow(page)
      expect(Math.abs(row.addTop - row.avatarTop), 'the + and the avatar are on different lines').toBeLessThanOrEqual(TOLERANCE)
      expect(row.addWidth, 'the + is not a round 44 px target').toBeGreaterThanOrEqual(44 - TOLERANCE)
      expect(row.addRight).toBeLessThanOrEqual(row.viewport + TOLERANCE)
      expect(row.avatarRight).toBeLessThanOrEqual(row.viewport + TOLERANCE)
      expect(row.pageWidth, 'the page scrolls sideways').toBeLessThanOrEqual(row.viewport)
    })
  }

  for (const width of WHOLE_TITLE_WIDTHS) {
    test(`at ${width} px the title is not cut`, async () => {
      await page.setViewportSize({ width, height: HEIGHT })
      await page.goto(CUSTOMERS)
      expect((await measureRow(page)).titleWhole, 'the title is cut').toBe(true)
    })
  }
})
