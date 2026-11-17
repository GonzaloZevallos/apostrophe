/**
 * The listed Phone countries as the real backend serves them (`GET /phone-countries`), so an
 * e2e spec never states a calling code or an example itself (docs/adr/20261111-phone-country-per-number): it reads them
 * from the same answer the Selector shows. Only the country's name is the spec's own text.
 */

import type { Page } from '@playwright/test'
import { expect } from '../fixtures.js'

interface Listing {
  code: string
  calling_code: string
  example: string
}

export interface ServedCountry {
  /** The Selector's text for the country: "Name (+code)". */
  label: string
  /** The local form the Phone field's placeholder shows. */
  example: string
  /** The digits of the calling code, without the "+". */
  callingCode: string
}

/** Asks as the signed-in seller; call it after sign-up. */
export async function servedCountry(page: Page, code: string, name: string): Promise<ServedCountry> {
  const response = await page.request.get('/phone-countries')
  expect(response.ok()).toBe(true)
  const listing = ((await response.json()) as Listing[]).find((entry) => entry.code === code)
  expect(listing, `${code} is listed`).toBeDefined()
  if (listing === undefined) throw new Error(`${code} is not listed`)
  return { label: `${name} (+${listing.calling_code})`, example: listing.example, callingCode: listing.calling_code }
}
