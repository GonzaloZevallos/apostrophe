/**
 * The phone's bottom chrome and its New sale entry: the one place an e2e spec locates them
 * (GH-727, D-69509906), so a later change to the bar changes locators here and nowhere else.
 *
 * The constants are literals on purpose and import nothing from `web/src`: if the product renames
 * a class, these locators break and say so, instead of silently following it. A spec that needs a
 * selector string (a `page.evaluate` argument, a fixture's `class`, a helper that takes a
 * selector) passes the constant; it never writes the class itself.
 *
 * The locator helpers never throw. Only `bottomChromeTop` does, when no bottom chrome is
 * rendered at all.
 */

import type { Locator, Page } from '@playwright/test'

/** The phone's fixed bottom bar (not the computer rail). */
export const BOTTOM_BAR_CLASS = 'bar-inferior'
export const BOTTOM_BAR = `.${BOTTOM_BAR_CLASS}`
export const BOTTOM_BAR_ITEM = '.bar-inferior__item'
/** The bar's + slot, the round box between the second tab and the third; never one of the tabs. */
export const BOTTOM_BAR_PLUS = '.bar-inferior__mas'
/** The phone's New sale entry is the bar's +; its accessible name is the one named Spanish word. */
export const NEW_SALE_BUTTON_CLASS = 'bar-inferior__mas'
export const NEW_SALE_BUTTON = `.${NEW_SALE_BUTTON_CLASS}`
export const NEW_SALE_NAME = 'Vender'
/** The computer rail's own New sale button. */
export const NEW_SALE_BUTTON_COMPUTER = '.boton-nueva-venta--escritorio'

/** The computer sidebar's name, the one `Shell` gives both of its navs; the bottom bar has no Settings link. */
const SIDEBAR_NAME = 'Navigation'

/** The computer sidebar's gear: role link named Settings inside the sidebar nav, never a class or the business name. */
export function railSettingsLink(page: Page): Locator {
  return page.getByRole('navigation', { name: SIDEBAR_NAME }).getByRole('link', { name: 'Settings', exact: true })
}

/**
 * The one way to Settings on whichever viewport the spec runs: the sidebar's gear on a computer, the
 * header's Settings avatar on a phone. Only one of the two is ever visible, so it never matches twice
 * (and where both match, the one element counts once).
 */
export function settingsEntry(page: Page): Locator {
  return railSettingsLink(page).or(page.getByRole('link', { name: 'Settings', exact: true }))
}

/** The phone bar only, never the rail. */
export function bottomBar(page: Page): Locator {
  return page.locator(BOTTOM_BAR)
}

export function bottomBarItems(page: Page): Locator {
  return bottomBar(page).locator(BOTTOM_BAR_ITEM)
}

/** The phone's New sale entry only: the bar's +, found by its role and name, never the rail's button. */
export function newSaleEntry(page: Page): Locator {
  return page.getByRole('link', { name: NEW_SALE_NAME, exact: true })
}

/**
 * Every phone New sale entry in the DOM, found by its class and not by role or name, so a count-zero
 * check cannot pass just because the entry lost its name or moved. It never matches the computer
 * rail's button (`NEW_SALE_BUTTON_COMPUTER`).
 */
export function anyNewSaleButton(page: Page): Locator {
  return page.locator(`a${NEW_SALE_BUTTON}`)
}

/** Taps the phone's New sale entry, the bar's +. */
export async function openNewSaleFromChrome(page: Page): Promise<void> {
  await newSaleEntry(page).click()
}

/**
 * The y of the highest rendered bottom chrome edge: the smallest `top` among the bar and its +
 * (which stands above the bar's top edge). It throws when none is rendered, so it never returns 0
 * or NaN.
 */
export async function bottomChromeTop(page: Page): Promise<number> {
  const top = await page.evaluate(
    ({ bar, plus }) => {
      const tops = [...document.querySelectorAll(`${bar}, ${plus}`)]
        .map((element) => element.getBoundingClientRect())
        .filter((rect) => rect.width > 1 && rect.height > 1)
        .map((rect) => rect.top)
      return tops.length === 0 ? null : Math.min(...tops)
    },
    { bar: BOTTOM_BAR, plus: BOTTOM_BAR_PLUS },
  )
  if (top === null) throw new Error('bottomChromeTop: no bottom chrome is rendered')
  return top
}
