/**
 * The Onboarding steps through a language switch (`applyShownLanguage` with a fixture `de`
 * bundle): the words `steps.ts` holds as keys (`nameKey`, and the `title`/`later` labels of
 * kind `key`) re-render in place, into the same DOM node, while the fields that stay plain
 * text until the onboarding area moves them (`why`, the labels of kind `text`) keep their
 * English, which puts the known gap on record.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen } from '@testing-library/react'
import { createMemoryRouter, Outlet, RouterProvider } from 'react-router'
import { afterEach, beforeEach, expect, test } from 'vitest'
import type { Me } from '../../api/me'
import type { OnboardingProgress, StepSlug, StepState } from '../../api/onboarding'
import common from '../../copy/locales/en/common.json'
import { ONBOARDING_TEXT } from '../../copy/onboarding'
import {
  applyShownLanguage,
  resetToBootLanguage,
  setLocaleLoader,
} from '../../i18n/language'
import { clearMissingKeys, missingKeys } from '../../i18n/missingKeys'
import { loadLocale } from '../../i18n/resources'
import { addFixtureNamespace, removeFixtureNamespace } from '../../i18n/testing'
import { SHOWN_EN } from '../../test/shownLanguage'
import Listo from './Listo'
import OnboardingStep from './OnboardingStep'

const ME: Me = { email: 'ana@x.com', business_name: 'La Huerta', today: '2026-10-03', shown_language: SHOWN_EN }
const ORDER: StepSlug[] = ['variety', 'stock', 'header_footer', 'bot', 'partner', 'categories']

/** Every common value is its own marker: `de:<key>`. */
const MARKERS = Object.fromEntries(Object.keys(common).map((name) => [name, `de:${name}`]))

function progress(states: StepState[]): OnboardingProgress {
  return {
    offered: true,
    over: false,
    count: states.filter((state) => state !== 'pending').length,
    resume: 'categories',
    steps: ORDER.map((step, index) => ({ step, state: states[index] ?? 'pending' })),
    can_skip_rest: true,
    varieties_count: 1,
    stock_entries_count: 1,
    price_target: null,
    priced_target: null,
    stock_target: null,
  }
}

function inRouter(element: React.ReactNode, answer: OnboardingProgress) {
  const router = createMemoryRouter(
    [{ path: '/', element: <Outlet context={{ me: ME, progress: answer }} />, children: [{ index: true, element }] }],
    { initialEntries: ['/'] },
  )
  render(
    <QueryClientProvider client={new QueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
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

test('"Listo" names each step through its nameKey and re-renders it in place on a switch', async () => {
  inRouter(<Listo />, progress(['done', 'pending', 'pending', 'pending', 'pending', 'pending']))
  const name = screen.getByText('Variety with price')
  const later = screen.getByText('For later — in Varieties')

  await switchToGerman()

  expect(screen.getByText('de:varietyWithPrice')).toBe(name)
  expect(screen.queryByText('Variety with price')).not.toBeInTheDocument()
  expect(screen.getByText('de:telegramBot')).toBeInTheDocument()
  // The "for later" line wraps a key label (`later` of the stock step) in English words.
  expect(later).toHaveTextContent('For later — in de:varieties')
  expect(missingKeys().filter((miss) => miss.language === 'de')).toEqual([])
})

test('a step frame re-renders its key title in place and keeps `why` in English', async () => {
  inRouter(
    <OnboardingStep slug="categories" me={ME} progress={progress(['done', 'done', 'pending', 'pending', 'pending', 'pending'])} Body={() => null} />,
    progress(['done', 'done', 'pending', 'pending', 'pending', 'pending']),
  )
  const title = screen.getByRole('heading', { name: 'Expense categories' })
  const why = screen.getByText(ONBOARDING_TEXT.theyOrganiseWhatYouSpend)

  await switchToGerman()

  expect(screen.getByRole('heading', { name: 'de:expenseCategories' })).toBe(title)
  expect(screen.queryByText('Expense categories')).not.toBeInTheDocument()
  // Known gap: `why` is ONBOARDING_TEXT until the onboarding area moves it to a key.
  expect(screen.getByText(ONBOARDING_TEXT.theyOrganiseWhatYouSpend)).toBe(why)
  expect(missingKeys().filter((miss) => miss.language === 'de')).toEqual([])
})
