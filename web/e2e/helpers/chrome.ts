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
/** The floating group above the bar: the + New sale button and, when there is one, its missing-price line. */
export const NEW_SALE_GROUP = '.nueva-venta-flotante'
export const NEW_SALE_BUTTON_CLASS = 'boton-nueva-venta'
export const NEW_SALE_BUTTON = `.${NEW_SALE_BUTTON_CLASS}`
/** The computer rail's own New sale button. */
export const NEW_SALE_BUTTON_COMPUTER = '.boton-nueva-venta--escritorio'

/** The phone bar only, never the rail. */
export function bottomBar(page: Page): Locator {
  return page.locator(BOTTOM_BAR)
}

export function bottomBarItems(page: Page): Locator {
  return bottomBar(page).locator(BOTTOM_BAR_ITEM)
}

/** The phone's floating New sale entry only, never the computer rail's button. */
export function newSaleEntry(page: Page): Locator {
  return page.locator(`${NEW_SALE_GROUP} > ${NEW_SALE_BUTTON}`)
}

/**
 * Every New sale button on the page, whichever chrome draws it. An absence or count-zero check
 * uses this and never `newSaleEntry`, so the check cannot pass just because the button moved
 * out of the group.
 */
export function anyNewSaleButton(page: Page): Locator {
  return page.locator(`a${NEW_SALE_BUTTON}`)
}

/** Taps the floating New sale entry. */
export async function openNewSaleFromChrome(page: Page): Promise<void> {
  await newSaleEntry(page).click()
}

/**
 * The y of the highest rendered bottom chrome edge: the smallest `top` among the bar and the
 * floating group's children (the missing-price line counts as chrome). It throws when none is
 * rendered, so it never returns 0 or NaN.
 *
 * Kept for GH-727 part 3; its only user today is `chromeHelpers.spec.ts`.
 */
export async function bottomChromeTop(page: Page): Promise<number> {
  const top = await page.evaluate(
    ({ bar, group }) => {
      const tops = [...document.querySelectorAll(`${bar}, ${group} > *`)]
        .map((element) => element.getBoundingClientRect())
        .filter((rect) => rect.width > 1 && rect.height > 1)
        .map((rect) => rect.top)
      return tops.length === 0 ? null : Math.min(...tops)
    },
    { bar: BOTTOM_BAR, group: NEW_SALE_GROUP },
  )
  if (top === null) throw new Error('bottomChromeTop: no bottom chrome is rendered')
  return top
}
