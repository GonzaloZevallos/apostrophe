/**
 * A language switch at the shell seam: the registry holds keys (`titleKey`, `labelKey`) and
 * `Shell` / `BackArrow` resolve them on every render, so applying another language re-renders
 * their words in the very nodes already on screen, with no remount. The fixture `de` bundle
 * answers every `common:` and `shell:` key with `de:<key>` (plus the placeholders it has), so
 * a marker in a node proves that node resolved its key under the new language.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen, within } from '@testing-library/react'
import { createMemoryRouter, Outlet, RouterProvider, type RouteObject } from 'react-router'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { Me } from '../api/me'
import i18n from '../i18n'
import { applyShownLanguage, resetToBootLanguage, setLocaleLoader } from '../i18n/language'
import { clearMissingKeys, missingKeys } from '../i18n/missingKeys'
import { englishBundle, loadLocale } from '../i18n/resources'
import { addFixtureNamespace, removeFixtureNamespace } from '../i18n/testing'
import { CATALOG, HOME, SCREENS, type Screen } from '../routes'
import { SHOWN_EN } from '../test/shownLanguage'
import Shell from './Shell'

const ME: Me = { email: 'ana@x.com', business_name: 'La Huerta', today: '2026-10-03', shown_language: SHOWN_EN }

const viewport = vi.hoisted(() => ({ current: 'phone' as 'phone' | 'computer' }))

vi.mock('./useViewport', () => ({ useViewport: () => viewport.current }))

const NAMESPACES = ['common', 'shell'] as const

/** `de:<key>` for each key of a namespace, keeping the placeholders so interpolation shows. */
function markers(ns: string): Record<string, string> {
  const content = englishBundle()[ns] as Record<string, string>
  return Object.fromEntries(
    Object.entries(content).map(([key, english]) => {
      const holes = english.match(/\{\{\s*\w+\s*\}\}/g) ?? []
      return [key, [`de:${key}`, ...holes].join(' ')]
    }),
  )
}

function installGerman(): void {
  for (const ns of NAMESPACES) addFixtureNamespace(ns, markers(ns), 'de')
  setLocaleLoader(() => Promise.resolve({}))
}

async function switchToGerman(): Promise<void> {
  clearMissingKeys()
  await act(async () => {
    await applyShownLanguage('de')
  })
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('network error'))))
})

afterEach(async () => {
  await act(async () => {
    await applyShownLanguage('en')
  })
  for (const ns of NAMESPACES) removeFixtureNamespace(ns, 'de')
  setLocaleLoader(loadLocale)
  resetToBootLanguage()
  clearMissingKeys()
  vi.unstubAllGlobals()
})

function leaf(entry: Screen): RouteObject {
  return { path: entry.path, element: <p>{entry.id}</p>, handle: { screen: entry.id } }
}

function renderShell(path: string, computer: boolean) {
  viewport.current = computer ? 'computer' : 'phone'
  const router = createMemoryRouter(
    [{ element: <Outlet context={ME} />, children: [{ element: <Shell />, children: SCREENS.map(leaf) }] }],
    { initialEntries: [path] },
  )
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
}

function noMissesFor(keys: readonly string[]): void {
  const missed = missingKeys().filter((miss) => keys.includes(`${miss.ns}:${miss.key}`))
  expect(missed).toEqual([])
}

test('on the phone a root re-renders a bar label, "New sale" and the nav name in the same nodes', async () => {
  const { container } = renderShell(HOME, false)
  const bar = container.querySelector('.bar-inferior') as HTMLElement
  const barLabel = within(bar).getByText('Sales')
  // Both surfaces are in the DOM (CSS picks one), so both draw "New sale".
  const newSales = screen.getAllByRole('link', { name: 'New sale' })
  expect(newSales).toHaveLength(2)
  expect(bar).toHaveAttribute('aria-label', 'Navigation')
  installGerman()

  await switchToGerman()

  expect(barLabel).toHaveTextContent('de:sales')
  expect(bar.contains(barLabel)).toBe(true)
  for (const newSale of newSales) {
    expect(newSale).toHaveTextContent('de:newSale')
    expect(newSale.isConnected).toBe(true)
  }
  expect(bar).toHaveAttribute('aria-label', 'de:navigation')
  expect(container).not.toHaveTextContent('Sales')
  expect(container).not.toHaveTextContent('New sale')
  noMissesFor(['common:sales', 'common:newSale', 'shell:navigation'])
})

test("on the phone a card re-renders its back arrow's registry parent word in the same node", async () => {
  const { container } = renderShell(CATALOG, false)
  const arrow = screen.getByRole('button', { name: '‹ Varieties' })
  installGerman()

  await switchToGerman()

  expect(arrow).toHaveTextContent('de:backArrow de:varieties')
  expect(arrow.isConnected).toBe(true)
  expect(container).not.toHaveTextContent('Varieties')
  noMissesFor(['common:backArrow', 'common:varieties'])
})

test('on a computer the rail re-renders a label and the business row name in the same nodes', async () => {
  const { container } = renderShell(HOME, true)
  const rail = container.querySelector('.riel-lateral') as HTMLElement
  const railLabel = within(rail).getByRole('link', { name: 'Expenses' })
  const business = within(rail).getByRole('link', { name: 'Settings for La Huerta' })
  installGerman()

  await switchToGerman()

  expect(railLabel).toHaveTextContent('de:expenses')
  expect(rail).toHaveAttribute('aria-label', 'de:navigation')
  expect(business).toHaveAttribute('aria-label', 'de:settingsFor La Huerta')
  expect(business).toHaveTextContent('La Huerta')
  expect(i18n.language).toBe('de')
  noMissesFor(['common:expenses', 'shell:navigation', 'common:settingsFor'])
})
