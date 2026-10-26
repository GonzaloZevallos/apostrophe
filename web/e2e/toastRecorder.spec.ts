/**
 * The toast recorder and `expectToast` (ADR-0040, "success toasts are observed in the page"),
 * through the real fixture, so the recorder that runs is the serialised source Playwright
 * sends through `addInitScript`.
 *
 * The first group drives the recorder with elements the page itself gets, on a signed-out
 * page: what counts as an entry, and what `expectToast` refuses. The last test drives real
 * screens: a `FlashProvider` toast, a toast on its own timer, and the history-state toast
 * of the customer card.
 */

import type { Page } from '@playwright/test'
import { CUSTOMER, CUSTOMER_NEW, HOME, VARIETIES } from '../src/routes.js'
import { expect, test } from './fixtures.js'
import { DOCUMENT_CHANGED, DOCUMENT_CHANGED_AT_MARK, NO_RECORDER, expectToast } from './helpers/toast.js'
import { expectPath } from './helpers/url.js'
import { signUpNewBusiness } from './helpers/signup.js'
import { uniqueTag } from './helpers/unique.js'

async function addToast(page: Page, text: string, options: { remove: boolean }): Promise<void> {
  await page.evaluate(
    ({ wanted, remove }) => {
      const toast = document.createElement('div')
      toast.className = 'toast'
      toast.setAttribute('role', 'status')
      toast.textContent = wanted
      document.body.append(toast)
      if (remove) toast.remove()
    },
    { wanted: text, remove: options.remove },
  )
}

async function recorded(page: Page): Promise<string[]> {
  return page.evaluate(() => window.__toastRecorder?.entries.map((entry) => entry.text) ?? [])
}

test.describe('the recorder and expectToast, on a page the test feeds', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await expect.poll(() => page.evaluate(() => document.body.children.length)).toBeGreaterThan(0)
  })

  test('an entry recorded before the mark is rejected', async ({ page }) => {
    await addToast(page, 'Early', { remove: false })
    await expect.poll(() => recorded(page)).toContain('Early')
    await expect(expectToast(page, 'Early', () => Promise.resolve())).rejects.toThrow(
      'no toast with the text "Early" was recorded after the action',
    )
  })

  test('a reload during the action fails, though the new document renders the toast again', async ({ page }) => {
    await page.addInitScript(() => {
      document.addEventListener('DOMContentLoaded', () => {
        const toast = document.createElement('div')
        toast.className = 'toast'
        toast.setAttribute('role', 'status')
        toast.textContent = 'Again'
        document.body.append(toast)
      })
    })
    await page.reload()
    await expect(page.locator('.toast[role=status]')).toHaveText('Again')
    await expect(expectToast(page, 'Again', () => page.reload())).rejects.toThrow(DOCUMENT_CHANGED)
  })

  test('a page with no recorder fails at once', async ({ page }) => {
    await page.evaluate(() => {
      delete window.__toastRecorder
    })
    await expect(expectToast(page, 'Anything', () => Promise.resolve())).rejects.toThrow(NO_RECORDER)
  })

  test('a mark read while the page navigates fails at once', async ({ page }) => {
    // Playwright's own error for a read that a navigation interrupts.
    const navigating = new Proxy(page, {
      get: (target, key) =>
        key === 'evaluate'
          ? () =>
              Promise.reject(
                new Error('page.evaluate: Execution context was destroyed, most likely because of a navigation'),
              )
          : Reflect.get(target, key),
    })
    await expect(expectToast(navigating, 'Anything', () => Promise.resolve())).rejects.toThrow(
      DOCUMENT_CHANGED_AT_MARK,
    )
  })

  test('a toast added and removed in one task is still found', async ({ page }) => {
    await expectToast(page, 'Blink', () => addToast(page, 'Blink', { remove: true }))
  })

  test('a toast removed before the action resolves is still found', async ({ page }) => {
    await expectToast(page, 'Gone by now', async () => {
      await addToast(page, 'Gone by now', { remove: false })
      await page.evaluate(() => {
        document.querySelector('.toast[role=status]')?.remove()
      })
      await expect(page.locator('.toast[role=status]')).toHaveCount(0)
    })
  })

  test('the same text written again on one toast yields one entry', async ({ page }) => {
    await addToast(page, 'Twice', { remove: false })
    await page.evaluate(() => {
      const toast = document.querySelector('.toast[role=status]')
      if (toast !== null) toast.textContent = 'Twice'
    })
    await addToast(page, 'Marker', { remove: false })
    await expect.poll(() => recorded(page)).toEqual(['Twice', 'Marker'])
  })

  test('elements other than the two watched classes are not recorded', async ({ page }) => {
    await page.evaluate(() => {
      const aviso = document.createElement('div')
      aviso.className = 'aviso-toast'
      aviso.setAttribute('role', 'status')
      aviso.textContent = 'Category toast'
      const alert = document.createElement('div')
      alert.className = 'toast'
      alert.setAttribute('role', 'alert')
      alert.textContent = 'Not a status'
      document.body.append(aviso, alert)
    })
    await addToast(page, 'Marker', { remove: false })
    await expect.poll(() => recorded(page)).toEqual(['Marker'])
  })
})

test('real screens: a flash toast, a toast on its own timer and the card\'s history-state toast', async ({
  page,
}) => {
  const businessName = `Flores del Registro ${uniqueTag()}`
  await signUpNewBusiness(page, { businessName, email: `duena-registro-${uniqueTag()}@example.com` })

  await page.goto(VARIETIES)
  await page.getByRole('link', { name: 'New variety' }).click()
  await page.getByLabel('Name').fill('Rosa')
  await page.getByRole('button', { name: 'Add the variety' }).click()
  await expect(page.getByText('Variety saved')).toBeVisible()
  await page.goto(VARIETIES)
  await page.getByRole('link', { name: '+ Stock entry' }).click()
  await page.getByLabel('Grams').fill('50')
  await page.getByLabel('Variety').selectOption({ label: 'Rosa' })
  await page.getByLabel('Total cost').fill('20000')
  // FlashProvider: 2.5 s on the flash toast.
  await expectToast(page, 'Entry saved', () => page.getByRole('button', { name: 'Save the entry' }).click())

  // IntegrationsGroup: its own 3 s timer.
  await page.goto(HOME)
  await page.getByRole('link', { name: /^Settings for / }).click()
  await page.getByRole('link', { name: 'Integrations', exact: true }).click()
  await page.getByLabel('Bot token').fill('123456:fake-token-for-e2e')
  await page.getByLabel('Your chat').fill('111111')
  await expectToast(page, 'Test sent', () => page.getByRole('button', { name: 'Test it' }).click())

  // ClienteFicha: the toast comes in history state, with no timer.
  await page.goto(CUSTOMER_NEW)
  await page.getByLabel('Name').fill('Noe Registro')
  await expectToast(page, 'Customer saved', () => page.getByRole('button', { name: 'Save and use' }).click())
  await expectPath(page, CUSTOMER)
})
