/**
 * Locators for the phone Settings home, by role and name: a shortcut is the link with its exact
 * label; a row is the link whose name starts with its label (the name is the label plus its
 * second line), looked up inside the group whose heading names it, so a row and a shortcut that
 * share a word (Prices, Payment methods) are never confused and no position decides the match.
 */

import type { Locator, Page } from '@playwright/test'

/** One of the three shortcuts above the groups, by its exact label. */
export function settingsShortcut(page: Page, label: string): Locator {
  return page.getByRole('link', { name: label, exact: true })
}

/** The row with `label` inside the group headed `group`. */
export function settingsRow(page: Page, group: string, label: string): Locator {
  return page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: group, exact: true }) })
    .getByRole('link', { name: new RegExp(`^${label}\\b`) })
}
