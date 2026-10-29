/**
 * `stock/detail.ts` through a language switch (`applyShownLanguage` with a fixture `de`
 * bundle): `warningFor` holds "Warning off" as a key, and the component rendering it
 * (`VarietyThresholdSection`) resolves it on every render, so the switch changes the text in
 * the same DOM node. The warning lines carrying a figure stay text until the stock area moves them.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import type { VarietyStock } from '../api/stock'
import common from '../copy/locales/en/common.json'
import FlashProvider from '../flash/FlashProvider'
import { applyShownLanguage, resetToBootLanguage, setLocaleLoader } from '../i18n/language'
import { clearMissingKeys, missingKeys } from '../i18n/missingKeys'
import { loadLocale } from '../i18n/resources'
import { addFixtureNamespace, removeFixtureNamespace } from '../i18n/testing'
import VarietyThresholdSection from '../screens/varieties/VarietyThresholdSection'
import { warningFor } from './detail'

const MARKERS = Object.fromEntries(Object.keys(common).map((name) => [name, `de:${name}`]))

const OFF: VarietyStock = { variety_id: 1, quantity: 90, status: 'ok', sold_out_since: null, threshold: null, days_left: 60 }
const LOW: VarietyStock = { variety_id: 1, quantity: 18, status: 'low', sold_out_since: null, threshold: 20, days_left: 24 }

function threshold(row: VarietyStock) {
  render(
    <MemoryRouter>
      <QueryClientProvider client={new QueryClient()}>
        <FlashProvider>
          <VarietyThresholdSection varietyId={1} row={row} refreshing={false} onGone={() => undefined} />
        </FlashProvider>
      </QueryClientProvider>
    </MemoryRouter>,
  )
}

async function switchToGerman(): Promise<void> {
  addFixtureNamespace('common', MARKERS, 'de')
  setLocaleLoader(() => Promise.resolve({ common: MARKERS }))
  clearMissingKeys()
  await act(async () => {
    await applyShownLanguage('de')
  })
}

beforeEach(() => {
  clearMissingKeys()
})

afterEach(() => {
  setLocaleLoader(loadLocale)
  resetToBootLanguage()
  removeFixtureNamespace('common', 'de')
})

describe('warningFor', () => {
  test('holds "Warning off" as a key, not as resolved text', () => {
    expect(warningFor(OFF)).toEqual({ kind: 'key', key: 'common:warningOff' })
  })

  test('keeps a line with a figure as text', () => {
    expect(warningFor(LOW)).toEqual({ kind: 'text', text: 'Warning: 18 g left' })
  })
})

test('the threshold section re-renders "Warning off" in place on a language switch', async () => {
  threshold(OFF)
  const line = screen.getByText('Warning off')

  await switchToGerman()

  expect(screen.getByText('de:warningOff')).toBe(line)
  expect(screen.queryByText('Warning off')).not.toBeInTheDocument()
  expect(missingKeys().filter((miss) => miss.language === 'de')).toEqual([])
})
