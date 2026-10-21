/**
 * Variedades' first-variety selection on a computer never takes over a tap the seller already
 * made (`VarietiesIndex.tsx`): leaving Variedades on the phone ("Mandar catálogo") while the
 * viewport turns computer before the new screen has rendered lands on the catalog, not on the
 * first variety. The CPU is slowed through the browser's own throttling so the tap's render is
 * still pending when the viewport changes, the window the race needs (it made
 * `catalog.spec.ts` fail on a slower runner).
 */

import { CATALOG, VARIETIES } from '../src/routes.js'
import { expectPath } from './helpers/url.js'
import { expect, test } from './fixtures.js'
import { signUpNewBusiness } from './helpers/signup.js'
import { uniqueTag } from './helpers/unique.js'

const PHONE = { width: 390, height: 844 }
const COMPUTER = { width: 1280, height: 720 }

test('a tap that leaves Variedades on the phone is not replaced when the viewport turns computer', async ({
  page,
  context,
}) => {
  await signUpNewBusiness(page, {
    businessName: `Selección ${uniqueTag()}`,
    email: `seleccion-${uniqueTag()}@example.com`,
  })
  await page.goto(VARIETIES)
  await page.getByRole('link', { name: 'New variety' }).click()
  await page.getByLabel('Name').fill('Rosa')
  await page.getByRole('button', { name: 'Add the variety' }).click()
  await expect(page.getByText('Variety saved')).toBeVisible()

  const cdp = await context.newCDPSession(page)
  for (let round = 0; round < 3; round++) {
    await page.setViewportSize(PHONE)
    await page.goto(VARIETIES)
    const send = page.getByRole('link', { name: 'Send catalog' })
    await send.waitFor()
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 20 })
    await send.click({ noWaitAfter: true })
    await page.setViewportSize(COMPUTER)
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 })
    await expectPath(page, CATALOG)
    await expect(page.getByRole('heading', { name: 'Catalog', level: 1 })).toBeVisible()
    await expectPath(page, CATALOG)
  }
})
