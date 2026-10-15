/**
 * The end of a variety's life through the front alone (`varieties.md`, "Deleting and
 * archiving"; "No curl"), on a phone and on a computer: a fresh variety with no history is
 * deleted; one with a sale (a gift line) is archived, found in Archivadas, opened read-only
 * and restored. Each removal is the action plus its one confirmation, Restaurar one tap.
 * No console message at any point.
 */

import { expect, test } from './fixtures.js'
import { SALE_NEW, VARIETIES } from '../src/routes.js'
import { watchConsole } from './console.js'
import { fillSaleLine } from './helpers/sale.js'
import { signUpNewBusiness } from './helpers/signup.js'

const VIEWPORTS = [
  { name: 'phone', width: 390, height: 844 },
  { name: 'computer', width: 1280, height: 720 },
] as const

for (const viewport of VIEWPORTS) {
  test.describe(viewport.name, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } })

    test('a seller deletes a fresh variety, archives one with a sale, finds it and restores it', async ({
      page,
    }) => {
      const computer = viewport.name === 'computer'
      const consoleMessages: string[] = []
      watchConsole(page, consoleMessages)
      await signUpNewBusiness(page, {
        businessName: `Archivo ${viewport.name} ${Date.now()}`,
        email: `archivo-${viewport.name}-${Date.now()}@example.com`,
      })

      async function addVariety(name: string): Promise<void> {
        await page.goto(VARIETIES)
        await page.getByRole('link', { name: 'Nueva variedad' }).click()
        await page.getByLabel('Nombre').fill(name)
        await page.getByRole('button', { name: 'Agregá la variedad' }).click()
        await expect(page.getByText('Variedad guardada')).toBeVisible()
      }

      // A fresh variety has no history: Eliminar variedad, one confirmation.
      await addVariety('Nube')
      await page.goto(VARIETIES)
      await page.getByRole('link', { name: /Nube/ }).click()
      await expect(page.getByRole('button', { name: 'Archivar variedad' })).toHaveCount(0)
      await page.getByRole('button', { name: 'Eliminar variedad' }).click()
      await page.getByRole('button', { name: 'Sí, eliminala' }).click()
      await expect(page.getByText('Variedad eliminada')).toBeVisible()
      await expect(page.getByRole('link', { name: /Nube/ })).toHaveCount(0)

      // One with a sale has history: Archivar variedad, one confirmation.
      await addVariety('Rosa')
      await page.goto(VARIETIES)
      await page.getByRole('link', { name: /Rosa/ }).click()
      await page.getByRole('link', { name: 'Nuevo precio' }).click()
      await page.getByLabel(/^Precio de lista/).fill('9000')
      await page.getByRole('button', { name: 'Guardá el precio' }).click()
      await expect(page.getByText('Precio guardado')).toBeVisible()
      await page.goto(SALE_NEW)
      await fillSaleLine(page, 1, { variety: 'Rosa', grams: '4', gift: true })
      await page.getByRole('button', { name: 'Guardá la venta' }).click()
      await expect(page.getByText('Venta guardada')).toBeVisible()
      await page.goto(VARIETIES)
      await page.getByRole('link', { name: /Rosa/ }).click()
      await expect(page.getByRole('button', { name: 'Eliminar variedad' })).toHaveCount(0)
      await page.getByRole('button', { name: 'Archivar variedad' }).click()
      await page.getByRole('button', { name: 'Sí, archivala' }).click()
      await expect(page.getByText('Variedad archivada')).toBeVisible()
      await expect(page.getByRole('link', { name: /Rosa/ })).toHaveCount(0)

      // Found in Archivadas (1); its page is read-only and Restaurar is the one action.
      await page.goto(VARIETIES)
      await page.getByRole('link', { name: /Archivadas \(1\)/ }).click()
      if (computer) {
        // The two panes select the first archived variety by name on their own.
        await expect(page).toHaveURL(/\/varieties\/[0-9]+$/)
      } else {
        await expect(page).toHaveURL(/\/varieties\/archived$/)
        await expect(page.getByRole('link', { name: '‹ Variedades' })).toBeVisible()
        await page.getByRole('link', { name: /Rosa/ }).click()
      }
      // The archived page's own heading, on both viewports (a phone has no Rosa link here).
      await expect(page.getByRole('heading', { name: 'Rosa' })).toBeVisible()
      await expect(page.getByRole('link', { name: '‹ Archivadas' })).toBeVisible()
      await expect(page.locator('.variedad-resumen').getByText('Archivada', { exact: true })).toBeVisible()
      await expect(page.getByText('+ Entrada')).toHaveCount(0)
      await expect(page.getByText('Nuevo precio')).toHaveCount(0)
      await expect(page.getByText('Sacar del stock')).toHaveCount(0)
      await expect(page.getByRole('button', { name: 'Archivar variedad' })).toHaveCount(0)
      await page.getByRole('link', { name: 'Ver todas' }).first().click()
      await expect(page.getByRole('button', { name: 'Borrar este precio' })).toHaveCount(0)
      await page.goBack()

      // Phone: back goes to Archivadas. Then Restaurar: one tap, no confirmation.
      if (!computer) {
        await page.getByRole('link', { name: '‹ Archivadas' }).click()
        await expect(page).toHaveURL(/\/varieties\/archived$/)
        await page.getByRole('link', { name: /Rosa/ }).click()
      }
      await page.getByRole('button', { name: 'Restaurar' }).last().click()
      await expect(page.getByText('Variedad restaurada')).toBeVisible()
      await expect(page.getByRole('button', { name: 'Archivar variedad' })).toBeVisible()
      await page.goto(VARIETIES)
      await expect(page.getByRole('link', { name: /Rosa/ })).toBeVisible()
      await expect(page.getByText(/Archivadas \(/)).toHaveCount(0)

      expect(consoleMessages).toEqual([])
    })
  })
}
