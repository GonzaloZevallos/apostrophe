/**
 * The long date line of Home and Analysis in a real phone browser (GH-748): at 320 px and 100 %
 * text the longest date shows whole, and at 130 % it stays one line and never pushes the avatar
 * out of the viewport. Light and dark, in the phone check's own project (its server and pinned
 * clock, one signed-in business shared by every cell).
 *
 * English runs through the real app: `GET /auth/me` answers 2026-09-30, so the line reads
 * "Wednesday, September 30". Spanish is not reachable in production before #317, so it is measured
 * on a copy: the whole date row is cloned under the same header and its date text set to
 * "Miércoles 30 de septiembre", the longest Spanish date, so the same CSS lays it out.
 */

import { expect, test, type Page } from '@playwright/test'
import { MOBILE_STATE_FILE } from './env.js'
import { applyTextScale, expectTextScaled, TEXT_SCALE } from './helpers/textScale.js'
import { newCell, THEMES, type Theme } from './mobile/cells.js'
import { guardWrites } from './mobile/network.js'
import { settle } from './mobile/walk.js'
import { ANALYSIS, HOME } from '../src/routes.ts'

const HEADER = '.inicio-cabecera'
const LONGEST_SPANISH = 'Miércoles 30 de septiembre'
const TOUCH = 44

interface Measure {
  text: string
  /** `scrollWidth <= clientWidth`: the text is whole, no ellipsis. */
  whole: boolean
  dateHeight: number
  dateFontSize: number
  avatarWidth: number
  avatarHeight: number
  avatarRight: number
  viewportWidth: number
}

/** The date and the avatar of the row at `index` under the header, measured in the page. */
async function measureRow(page: Page, index: number): Promise<Measure> {
  return page.evaluate(
    ({ header, at }) => {
      const row = document.querySelectorAll(`${header} > .inicio-cabecera__fila`)[at]
      if (row === undefined) throw new Error(`no date row ${at}`)
      const date = row.querySelector<HTMLElement>('.inicio-cabecera__fecha')
      const avatar = row.querySelector<HTMLElement>('.inicio__avatar')
      if (date === null || avatar === null) throw new Error('the row has no date or no avatar')
      const avatarBox = avatar.getBoundingClientRect()
      return {
        text: date.textContent ?? '',
        whole: date.scrollWidth <= date.clientWidth,
        dateHeight: date.getBoundingClientRect().height,
        dateFontSize: parseFloat(getComputedStyle(date).fontSize),
        avatarWidth: avatarBox.width,
        avatarHeight: avatarBox.height,
        avatarRight: avatarBox.right,
        viewportWidth: document.documentElement.clientWidth,
      }
    },
    { header: HEADER, at: index },
  )
}

function expectAvatarSafe(measure: Measure, where: string): void {
  expect(measure.avatarWidth, `${where}: avatar width`).toBeGreaterThanOrEqual(TOUCH - 0.5)
  expect(measure.avatarHeight, `${where}: avatar height`).toBeGreaterThanOrEqual(TOUCH - 0.5)
  expect(measure.avatarRight, `${where}: avatar inside the viewport`).toBeLessThanOrEqual(measure.viewportWidth + 0.5)
}

/** One line box: a line is never taller than twice its own font size, two lines always are. */
function expectOneLine(measure: Measure, where: string): void {
  expect(measure.dateHeight, `${where}: one line high`).toBeLessThan(measure.dateFontSize * 2)
}

for (const theme of THEMES) {
  for (const route of [HOME, ANALYSIS]) {
    test(`the date line at 320 px on ${route}, ${theme}`, async ({ browser }) => {
      const context = await newCell(browser, '320x568', theme as Theme, MOBILE_STATE_FILE)
      await guardWrites(context)
      const page = await context.newPage()
      await page.route('**/auth/me', async (handler) => {
        const response = await handler.fetch()
        const me = (await response.json()) as Record<string, unknown>
        await handler.fulfill({ response, json: { ...me, today: '2026-09-30', shown_language: 'en' } })
      })
      await page.goto(route)
      await settle(page)
      await expect(page.locator('.inicio-cabecera__fecha')).toHaveText('Wednesday, September 30')

      // Spanish, on a copy of the whole row under the same header.
      await page.evaluate(
        ({ header, text }) => {
          const parent = document.querySelector(header)
          const row = parent?.querySelector('.inicio-cabecera__fila')
          if (parent === null || parent === undefined || row === null || row === undefined) throw new Error('no date row')
          const copy = row.cloneNode(true) as HTMLElement
          const date = copy.querySelector('.inicio-cabecera__fecha')
          if (date === null) throw new Error('no date in the copy')
          date.textContent = text
          parent.appendChild(copy)
        },
        { header: HEADER, text: LONGEST_SPANISH },
      )

      for (const [index, expected] of [
        [0, 'Wednesday, September 30'],
        [1, LONGEST_SPANISH],
      ] as const) {
        const at100 = await measureRow(page, index)
        expect(at100.text).toBe(expected)
        expect(at100.whole, `${expected} at 100 %: shown whole`).toBe(true)
        expectOneLine(at100, `${expected} at 100 %`)
        expectAvatarSafe(at100, `${expected} at 100 %`)
      }

      const scaled = await applyTextScale(page, HEADER, TEXT_SCALE)
      await expectTextScaled(page, scaled, TEXT_SCALE)
      for (const index of [0, 1]) {
        const at130 = await measureRow(page, index)
        expectOneLine(at130, `${at130.text} at 130 %`)
        expectAvatarSafe(at130, `${at130.text} at 130 %`)
      }
      await context.close()
    })
  }
}
