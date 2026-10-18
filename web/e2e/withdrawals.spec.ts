/**
 * Stock withdrawals' own end-to-end run (PRD metric "No curl"): a seller records a
 * withdrawal from Más and one from a variety's page, edits one and deletes one, and reads
 * Promoción and Consumo propio on Inicio (Semana and Mes, never Hoy) and on Análisis,
 * through the built front alone, against the real backend.
 *
 * Rosa's only lot is 50 g for $ 20.000 ($ 400 the gram), so each line's cost is its grams
 * times 400: the promotion ends at 4 g ($ 1.600) and the own use at 2 g ($ 800).
 */

import { expect, test } from './fixtures.js'
import { ANALYSIS, HOME, VARIETIES, WITHDRAWAL_NEW } from '../src/routes.js'
import { watchConsole } from './console.js'
import { openMas } from './helpers/openMas.js'
import { signUpNewBusiness } from './helpers/signup.js'
import { uniqueTag } from './helpers/unique.js'

test('a seller records, edits and deletes withdrawals and reads Promoción and Consumo propio', async ({
  page,
}) => {
  const consoleMessages: string[] = []
  watchConsole(page, consoleMessages)

  const businessName = `Flores del Retiro ${uniqueTag()}`
  await signUpNewBusiness(page, { businessName, email: `duena-retiro-${uniqueTag()}@example.com` })
  await expect(page.locator('.encabezado__negocio')).toHaveText(businessName)

  // A variety with one lot: 50 g for $ 20.000.
  await page.goto(VARIETIES)
  await page.getByRole('link', { name: 'Nueva variedad' }).click()
  await page.getByLabel('Nombre').fill('Rosa')
  await page.getByRole('button', { name: 'Agregá la variedad' }).click()
  await expect(page.getByText('Variedad guardada')).toBeVisible()
  await page.goto(VARIETIES)
  await page.getByRole('link', { name: '+ Entrada de stock' }).click()
  await page.getByLabel('Gramos').fill('50')
  await page.getByLabel('Variedad').selectOption({ label: 'Rosa' })
  await page.getByLabel('Costo total').fill('20000')
  await page.getByRole('button', { name: 'Guardá la entrada' }).click()
  await expect(page.getByText('Entry saved')).toBeVisible()

  // From Más: a promotion of 5 g. The reason has no default, so saving waits for it.
  await openMas(page)
  await page.getByRole('navigation', { name: 'More' }).getByRole('link', { name: /^Take out of stock/ }).click()
  await expect(page).toHaveURL((url) => url.pathname === WITHDRAWAL_NEW)
  await expect(page.getByRole('button', { name: 'Cerrar' })).toBeVisible()
  await page.getByLabel('Variedad 1', { exact: true }).selectOption({ label: 'Rosa' })
  await page.getByLabel('Gramos 1', { exact: true }).fill('5')
  await expect(page.getByRole('button', { name: 'Guardá el retiro' })).toBeDisabled()
  await page.getByRole('button', { name: 'Promoción', exact: true }).click()
  await page.getByRole('button', { name: 'Guardá el retiro' }).click()
  await expect(page.getByText('Retiro guardado')).toBeVisible()

  // From the variety's page: an own use of 2 g, with the variety already chosen.
  await page.goto(VARIETIES)
  await page.getByRole('link', { name: /Rosa/ }).click()
  await expect(page.getByText('−5 g')).toBeVisible()
  // The variety's own "Sacar del stock" (the list beside it carries one with no variety).
  await page.locator(`a[href*="${WITHDRAWAL_NEW}?variety="]`, { hasText: 'Take out of stock' }).click()
  await expect(page.getByLabel('Variedad 1', { exact: true })).toHaveValue(/\d+/)
  await page.getByRole('button', { name: 'Consumo propio', exact: true }).click()
  await page.getByLabel('Gramos 1', { exact: true }).fill('2')
  await page.getByRole('button', { name: 'Guardá el retiro' }).click()
  await expect(page.getByText('Retiro guardado')).toBeVisible()
  await expect(page.getByText('−2 g')).toBeVisible()

  // A third one, a promotion of 1 g, to delete.
  await openMas(page)
  await page.getByRole('navigation', { name: 'More' }).getByRole('link', { name: /^Take out of stock/ }).click()
  await page.getByLabel('Variedad 1', { exact: true }).selectOption({ label: 'Rosa' })
  await page.getByLabel('Gramos 1', { exact: true }).fill('1')
  await page.getByRole('button', { name: 'Promoción', exact: true }).click()
  await page.getByRole('button', { name: 'Guardá el retiro' }).click()
  await expect(page.getByText('Retiro guardado')).toBeVisible()

  // Delete it from its detail, after "Antes de borrar".
  await page.goto(VARIETIES)
  await page.getByRole('link', { name: /Rosa/ }).click()
  await page.getByRole('link', { name: /−1 g/ }).click()
  await expect(page).toHaveURL(/\/withdrawals\/\d+$/)
  await page.getByRole('button', { name: 'Borrar' }).click()
  await expect(page.getByText('Antes de borrar')).toBeVisible()
  await expect(page.getByText(/Vuelven 1 g al stock\./)).toBeVisible()
  await page.getByRole('button', { name: 'Sí, borralo' }).click()
  await expect(page.getByText('Retiro eliminado')).toBeVisible()

  // Edit the 5 g promotion down to 4 g; saving is confirmed first.
  await page.goto(VARIETIES)
  await page.getByRole('link', { name: /Rosa/ }).click()
  await expect(page.getByRole('link', { name: /−1 g/ })).toHaveCount(0)
  await page.getByRole('link', { name: /−5 g/ }).click()
  await page.getByRole('link', { name: 'Editar' }).click()
  await page.getByLabel('Gramos 1', { exact: true }).fill('4')
  await page.getByRole('button', { name: 'Guardar', exact: true }).click()
  await page.getByRole('button', { name: 'Sí, guardar' }).click()
  await expect(page.getByText('Retiro guardado')).toBeVisible()

  // Inicio: Hoy shows neither line; Semana and Mes show both, at lot cost.
  await page.goto(HOME)
  await expect(page.getByText('You sold today')).toBeVisible()
  await expect(page.getByText('Promotion')).toHaveCount(0)
  await expect(page.getByText('Own use')).toHaveCount(0)
  for (const [tab, heading] of [
    ['Week', 'You sold this week'],
    ['Month', 'You sold this month'],
  ] as const) {
    await page.getByRole('button', { name: tab, exact: true }).click()
    await expect(page.getByText(heading)).toBeVisible()
    const promotion = page.locator('.panel-lista__fila').filter({ hasText: 'Promotion' })
    await expect(promotion).toContainText('$ 1.600')
    const ownUse = page.locator('.panel-lista__fila').filter({ hasText: 'Own use' })
    await expect(ownUse).toContainText('$ 800')
    await expect(page.locator('.panel-lista__fila').filter({ hasText: 'Cost of goods sold' })).toContainText(
      '$ 0',
    )
  }

  // Análisis: the same two figures, apart from Faltante de stock.
  await openMas(page)
  await page.getByRole('navigation', { name: 'More' }).getByRole('link', { name: /^Analysis/ }).click()
  await expect(page).toHaveURL((url) => url.pathname === ANALYSIS)
  await expect(page.getByText('Promotion $ 1.600').first()).toBeVisible()
  await expect(page.getByText('Own use $ 800').first()).toBeVisible()

  expect(consoleMessages).toEqual([])
})
