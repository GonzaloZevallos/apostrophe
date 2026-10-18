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
  await page.getByRole('link', { name: 'New variety' }).click()
  await page.getByLabel('Name').fill('Rosa')
  await page.getByRole('button', { name: 'Add variety' }).click()
  await expect(page.getByText('Variety saved')).toBeVisible()
  await page.goto(VARIETIES)
  await page.getByRole('link', { name: '+ Stock entry' }).click()
  await page.getByLabel('Grams').fill('50')
  await page.getByLabel('Variety').selectOption({ label: 'Rosa' })
  await page.getByLabel('Total cost').fill('20000')
  await page.getByRole('button', { name: 'Save entry' }).click()
  await expect(page.getByText('Entry saved')).toBeVisible()

  // From Más: a promotion of 5 g. The reason has no default, so saving waits for it.
  await openMas(page)
  await page.getByRole('navigation', { name: 'Más' }).getByRole('link', { name: /^Sacar del stock/ }).click()
  await expect(page).toHaveURL((url) => url.pathname === WITHDRAWAL_NEW)
  await expect(page.getByRole('button', { name: 'Close' })).toBeVisible()
  await page.getByLabel('Variety 1', { exact: true }).selectOption({ label: 'Rosa' })
  await page.getByLabel('Grams 1', { exact: true }).fill('5')
  await expect(page.getByRole('button', { name: 'Save withdrawal' })).toBeDisabled()
  await page.getByRole('button', { name: 'Promotion', exact: true }).click()
  await page.getByRole('button', { name: 'Save withdrawal' }).click()
  await expect(page.getByText('Withdrawal saved')).toBeVisible()

  // From the variety's page: an own use of 2 g, with the variety already chosen.
  await page.goto(VARIETIES)
  await page.getByRole('link', { name: /Rosa/ }).click()
  await expect(page.getByText('−5 g')).toBeVisible()
  // The variety's own "Take out of stock" (the list beside it carries one with no variety).
  await page.locator(`a[href*="${WITHDRAWAL_NEW}?variety="]`, { hasText: 'Take out of stock' }).click()
  await expect(page.getByLabel('Variety 1', { exact: true })).toHaveValue(/\d+/)
  await page.getByRole('button', { name: 'Own use', exact: true }).click()
  await page.getByLabel('Grams 1', { exact: true }).fill('2')
  await page.getByRole('button', { name: 'Save withdrawal' }).click()
  await expect(page.getByText('Withdrawal saved')).toBeVisible()
  await expect(page.getByText('−2 g')).toBeVisible()

  // A third one, a promotion of 1 g, to delete.
  await openMas(page)
  await page.getByRole('navigation', { name: 'Más' }).getByRole('link', { name: /^Sacar del stock/ }).click()
  await page.getByLabel('Variety 1', { exact: true }).selectOption({ label: 'Rosa' })
  await page.getByLabel('Grams 1', { exact: true }).fill('1')
  await page.getByRole('button', { name: 'Promotion', exact: true }).click()
  await page.getByRole('button', { name: 'Save withdrawal' }).click()
  await expect(page.getByText('Withdrawal saved')).toBeVisible()

  // Delete it from its detail, after "Antes de borrar".
  await page.goto(VARIETIES)
  await page.getByRole('link', { name: /Rosa/ }).click()
  await page.getByRole('link', { name: /−1 g/ }).click()
  await expect(page).toHaveURL(/\/withdrawals\/\d+$/)
  await page.getByRole('button', { name: 'Delete' }).click()
  await expect(page.getByText('Before deleting')).toBeVisible()
  await expect(page.getByText(/Vuelven 1 g al stock\./)).toBeVisible()
  await page.getByRole('button', { name: 'Yes, delete it' }).click()
  await expect(page.getByText('Withdrawal deleted')).toBeVisible()

  // Edit the 5 g promotion down to 4 g; saving is confirmed first.
  await page.goto(VARIETIES)
  await page.getByRole('link', { name: /Rosa/ }).click()
  await expect(page.getByRole('link', { name: /−1 g/ })).toHaveCount(0)
  await page.getByRole('link', { name: /−5 g/ }).click()
  await page.getByRole('link', { name: 'Edit' }).click()
  await page.getByLabel('Grams 1', { exact: true }).fill('4')
  await page.getByRole('button', { name: 'Guardar', exact: true }).click()
  await page.getByRole('button', { name: 'Sí, guardar' }).click()
  await expect(page.getByText('Withdrawal saved')).toBeVisible()

  // Inicio: Hoy shows neither line; Semana and Mes show both, at lot cost.
  await page.goto(HOME)
  await expect(page.getByText('Vendiste hoy')).toBeVisible()
  await expect(page.getByText('Promoción')).toHaveCount(0)
  await expect(page.getByText('Consumo propio')).toHaveCount(0)
  for (const [tab, heading] of [
    ['Semana', 'Vendiste esta semana'],
    ['Mes', 'Vendiste este mes'],
  ] as const) {
    await page.getByRole('button', { name: tab, exact: true }).click()
    await expect(page.getByText(heading)).toBeVisible()
    const promotion = page.locator('.panel-lista__fila').filter({ hasText: 'Promoción' })
    await expect(promotion).toContainText('$ 1.600')
    const ownUse = page.locator('.panel-lista__fila').filter({ hasText: 'Consumo propio' })
    await expect(ownUse).toContainText('$ 800')
    await expect(page.locator('.panel-lista__fila').filter({ hasText: 'Costo de lo vendido' })).toContainText(
      '$ 0',
    )
  }

  // Análisis: the same two figures, apart from Faltante de stock.
  await openMas(page)
  await page.getByRole('navigation', { name: 'Más' }).getByRole('link', { name: /^Análisis/ }).click()
  await expect(page).toHaveURL((url) => url.pathname === ANALYSIS)
  await expect(page.getByText('Promoción $ 1.600').first()).toBeVisible()
  await expect(page.getByText('Consumo propio $ 800').first()).toBeVisible()

  expect(consoleMessages).toEqual([])
})
