/**
 * The end of a variety's life through the front alone (`varieties.md`, "Deleting and
 * archiving"; "No curl"): a fresh variety with no history is deleted; one with a stock entry
 * (its history) is archived, found in Archivadas, opened read-only and restored. Each removal
 * is the action plus its one confirmation. No console message at any point.
 */

import { expect, test } from '@playwright/test'
import { watchConsole } from './console.js'
import { signUpNewBusiness } from './helpers/signup.js'

test('a seller deletes a fresh variety, archives one with history, finds it and restores it', async ({ page }) => {
  const consoleMessages: string[] = []
  watchConsole(page, consoleMessages)
  await signUpNewBusiness(page, {
    businessName: `Archivo ${Date.now()}`,
    email: `archivo-${Date.now()}@example.com`,
  })

  async function addVariety(name: string): Promise<void> {
    await page.goto('/varieties')
    await page.getByRole('link', { name: 'Nueva variedad' }).click()
    await page.getByLabel('Nombre').fill(name)
    await page.getByRole('button', { name: 'Agregá la variedad' }).click()
    await expect(page.getByText('Variedad guardada')).toBeVisible()
  }

  // A fresh variety has no history: Eliminar variedad, one confirmation.
  await addVariety('Nube')
  await page.goto('/varieties')
  await page.getByRole('link', { name: /Nube/ }).click()
  await expect(page.getByRole('button', { name: 'Archivar variedad' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Eliminar variedad' }).click()
  await page.getByRole('button', { name: 'Sí, eliminala' }).click()
  await expect(page.getByText('Variedad eliminada')).toBeVisible()
  await expect(page.getByRole('link', { name: /Nube/ })).toHaveCount(0)

  // One with a stock entry has history: Archivar variedad, one confirmation.
  await addVariety('Rosa')
  await page.goto('/varieties')
  await page.getByRole('link', { name: '+ Entrada de stock' }).click()
  await expect(page).toHaveURL(/\/varieties\/entries\/new$/)
  await page.getByLabel('Gramos').fill('50')
  await page.getByLabel('Variedad').selectOption({ label: 'Rosa' })
  await page.getByLabel('Costo total').fill('45000')
  await page.getByRole('button', { name: 'Guardá la entrada' }).click()
  await expect(page.getByText('Entrada guardada')).toBeVisible()
  await page.goto('/varieties')
  await page.getByRole('link', { name: /Rosa/ }).click()
  await expect(page.getByRole('button', { name: 'Eliminar variedad' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Archivar variedad' }).click()
  await page.getByRole('button', { name: 'Sí, archivala' }).click()
  await expect(page.getByText('Variedad archivada')).toBeVisible()
  await expect(page.getByRole('link', { name: /Rosa/ })).toHaveCount(0)

  // Found in Archivadas (1), its page is read-only, Restaurar is the one action.
  await page.goto('/varieties')
  await page.getByRole('link', { name: /Archivadas \(1\)/ }).click()
  await expect(page).toHaveURL(/\/varieties\/archived$/)
  await page.getByRole('link', { name: /Rosa/ }).click()
  await expect(page.getByRole('link', { name: '‹ Archivadas' })).toBeVisible()
  await expect(page.locator('.variedad-resumen').getByText('Archivada', { exact: true })).toBeVisible()
  await expect(page.getByText('+ Entrada')).toHaveCount(0)
  await expect(page.getByText('Nuevo precio')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Archivar variedad' })).toHaveCount(0)

  // Restaurar: one tap, no confirmation; the variety is live again.
  await page.getByRole('button', { name: 'Restaurar' }).last().click()
  await expect(page.getByText('Variedad restaurada')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Archivar variedad' })).toBeVisible()
  await page.goto('/varieties')
  await expect(page.getByRole('link', { name: /Rosa/ })).toBeVisible()
  await expect(page.getByText(/Archivadas \(/)).toHaveCount(0)

  expect(consoleMessages).toEqual([])
})
