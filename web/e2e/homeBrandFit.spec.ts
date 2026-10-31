/**
 * The mark in Home's phone header (`brandmark-home-rail-onboarding`): at 320 px and at 246 px
 * (130 % text) a short business name shows the mark, an image named "apostrophe", and the
 * 60-character fixture name hides it. In both cases the header's height, the business
 * name's size and line, and the title's position are those of the same page with the mark removed, and
 * the page does not scroll sideways: the brand never costs the name a character or the
 * header a pixel.
 */

import { HOME } from '../src/routes.js'
import { expect, test } from './fixtures.js'
import type { Page } from '@playwright/test'
import { leaveOnboarding, DEFAULT_PASSWORD } from './helpers/signup.js'
import { newBusinessInvitationUrl } from './backend.js'
import { uniqueTag } from './helpers/unique.js'

const WIDTHS = [320, 246] as const
const SHORT_NAME = 'Flores'
const LONG_NAME = `Vivero ${'Larguísimo'.repeat(6)}`.slice(0, 60)

test.use({ isMobile: true, hasTouch: true })

interface Geometry {
  header: number
  name: { x: number; y: number; width: number; height: number }
  title: { x: number; y: number }
  scroll: number
  client: number
}

async function geometry(page: Page): Promise<Geometry> {
  return page.evaluate(() => {
    const rect = (selector: string) => {
      const element = document.querySelector(selector)
      if (element === null) throw new Error(`no element for ${selector}`)
      return element.getBoundingClientRect()
    }
    const name = rect('.encabezado__negocio')
    const title = rect('.encabezado__titulo')
    return {
      header: rect('.inicio__cabecera').height,
      name: { x: name.x, y: name.y, width: name.width, height: name.height },
      title: { x: title.x, y: title.y },
      scroll: document.documentElement.scrollWidth,
      client: document.documentElement.clientWidth,
    }
  })
}

async function signUp(page: Page, businessName: string): Promise<void> {
  await page.goto(newBusinessInvitationUrl())
  await page.getByLabel('Business name').fill(businessName)
  await page.getByLabel('Email address').fill(`marca-${uniqueTag()}@example.com`)
  await page.getByLabel('Password').fill(DEFAULT_PASSWORD)
  await page.getByRole('button', { name: 'Create the business' }).click()
  await leaveOnboarding(page)
}

for (const [label, businessName, shows] of [
  ['a short business name', SHORT_NAME, true],
  ['the 60-character business name', LONG_NAME, false],
] as const) {
  test(`${label} ${shows ? 'shows' : 'hides'} the header mark at 320 and 246 px without moving anything`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 700 })
    await signUp(page, businessName)

    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 700 })
      await page.goto(HOME)
      await expect(page.locator('.encabezado__negocio')).toBeVisible()

      const main = page.getByRole('main')
      const mark = main.getByRole('img', { name: 'apostrophe' })
      const markImage = main.getByAltText('apostrophe')
      if (shows) {
        await expect(mark).toBeVisible()
      } else {
        await expect(mark).toHaveCount(0)
        await expect(markImage).toHaveAttribute('aria-hidden', 'true')
        await expect(markImage).not.toBeInViewport()
      }

      const withMark = await geometry(page)
      await markImage.evaluate((node) => node.remove())
      const without = await geometry(page)

      expect(withMark.header, `header height at ${width} px`).toBe(without.header)
      // A visible mark sits before the name, so the name moves along the row and nowhere else;
      // a hidden one leaves the name exactly where it is.
      const { x: nameX, ...nameBox } = withMark.name
      const { x: nameXWithout, ...nameBoxWithout } = without.name
      expect(nameBox, `the name's size and line at ${width} px`).toEqual(nameBoxWithout)
      if (!shows) expect(nameX, `the name's start at ${width} px`).toBe(nameXWithout)
      expect(withMark.title, `the title's position at ${width} px`).toEqual(without.title)
      expect(withMark.scroll, `page scroll width at ${width} px`).toBeLessThanOrEqual(withMark.client)
    }
  })
}
