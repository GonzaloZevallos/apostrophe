/**
 * The bar fits (PRD criterion 2): at 320 px wide with text at 130 %, every tab label shows
 * whole, on one line. Measured in a real browser, since jsdom lays nothing out: each tab and label sits
 * inside the viewport, nothing overflows sideways, and no label is wider than its own box.
 */

import { HOME } from '../src/routes.js'
import { expect, test } from '@playwright/test'
import { newBusinessInvitationUrl } from './backend.js'

const PASSWORD = 'correcthorsebattery'
const WIDTH = 320

test.use({ viewport: { width: WIDTH, height: 640 } })

test('at 320 px with text at 130 %, every bar label is whole', async ({ page }) => {
  await page.goto(newBusinessInvitationUrl())
  await page.getByLabel('Nombre del negocio').fill(`Flores del Ajuste ${Date.now()}`)
  await page.getByLabel('Email').fill(`duena-ajuste-${Date.now()}@example.com`)
  await page.getByLabel('Contraseña').fill(PASSWORD)
  await page.getByRole('button', { name: 'Creá el negocio' }).click()
  await expect(page.locator('.encabezado__negocio')).toBeVisible()
  await page.goto(HOME)

  await page.evaluate(() => {
    document.documentElement.style.fontSize = '130%'
  })

  const bar = page.locator('.bar-inferior')
  await expect(bar.getByRole('link')).toHaveText(['Inicio', 'Ventas', 'Clientes', 'Variedades', 'Más'])
  const fit = await bar.evaluate((element, width) => {
    const barBox = element.getBoundingClientRect()
    return {
      barOverflows: element.scrollWidth > element.clientWidth,
      barInside: barBox.left >= 0 && barBox.right <= width,
      tabs: [...element.querySelectorAll('a')].map((tab) => {
        const label = tab.querySelector('span')
        const tabBox = tab.getBoundingClientRect()
        const labelBox = label?.getBoundingClientRect()
        // The label's text, measured one line at a time, cannot be wider than its tab.
        const range = document.createRange()
        if (label !== null) range.selectNodeContents(label)
        const textBox = range.getBoundingClientRect()
        return {
          text: label?.textContent ?? '',
          // Every label is one word, so one client rect per line means it is not broken.
          lines: range.getClientRects().length,
          inside: tabBox.left >= 0 && tabBox.right <= width,
          labelInTab:
            labelBox !== undefined &&
            labelBox.left >= tabBox.left - 0.5 &&
            labelBox.right <= tabBox.right + 0.5,
          textInTab: textBox.left >= tabBox.left - 0.5 && textBox.right <= tabBox.right + 0.5,
          overflows: label !== null && label.scrollWidth > label.clientWidth,
        }
      }),
    }
  }, WIDTH)

  expect(fit.barOverflows).toBe(false)
  expect(fit.barInside).toBe(true)
  for (const tab of fit.tabs) {
    expect(tab, tab.text).toMatchObject({
      inside: true,
      labelInTab: true,
      textInTab: true,
      overflows: false,
      lines: 1,
    })
  }
})
