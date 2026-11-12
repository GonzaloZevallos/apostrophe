/**
 * `BusinessGroup`'s language control with a second shipped language: the set of languages the
 * Copy module has texts for is mocked to English and Deutsch, so these tests can tap a second
 * language, refuse one, and show a stored language that is off the Selectable list. The API is
 * faked at `fetch`, never mocked deeper (CODING_STANDARDS §10).
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, Outlet, RouterProvider } from 'react-router'
import { afterEach, expect, test, vi } from 'vitest'
import type { Me } from '../../api/me'
import { inAppState } from '../../components/inAppState'
import { LOGIN, SETTINGS, SETTINGS_BUSINESS } from '../../routes'
import { MoneyFormatProvider } from '../../format/MoneyFormatProvider'
import { SHOWN_EN } from '../../test/shownLanguage'
import BusinessGroup from './BusinessGroup'

vi.mock('../../copy/readers/shippedLanguages', () => ({ SHIPPED_LANGUAGE_TAGS: ['en', 'de'] }))

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

const ME: Me = {
  email: 'vos@lahuerta.com',
  business_name: 'La Huerta',
  today: '2026-10-02',
  shown_language: SHOWN_EN,
  money: { symbol: '$', decimals: 0 },
}

function Provide() {
  return (
    <MoneyFormatProvider format={ME.money}>
      <Outlet context={ME} />
    </MoneyFormatProvider>
  )
}

const BUSINESS = {
  phone_country: 'AR',
  phone_countries: [{ code: 'AR', calling_code: '54' }],
  name: 'La Huerta',
  language: 'en',
  selectable_languages: ['en'],
  users: [{ email: 'vos@lahuerta.com' }, { email: 'juli@lahuerta.com' }],
}

afterEach(() => {
  vi.unstubAllGlobals()
})

function renderBusiness(fetchMock: ReturnType<typeof vi.fn>): QueryClient {
  vi.stubGlobal('fetch', fetchMock)
  const queryClient = new QueryClient()
  const router = createMemoryRouter(
    [
      {
        element: <Provide />,
        children: [
          { path: SETTINGS, element: <div>Lista de grupos</div> },
          { path: SETTINGS_BUSINESS, element: <BusinessGroup /> },
        ],
      },
      { path: LOGIN, element: <div>Pantalla de entrada</div> },
    ],
    {
      initialEntries: [SETTINGS, { pathname: SETTINGS_BUSINESS, state: inAppState({ pathname: SETTINGS }) }],
      initialIndex: 1,
    },
  )
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
  return queryClient
}

const TWO_LANGUAGES = { ...BUSINESS, selectable_languages: ['en', 'de'] }

test('with more than one language selectable the control marks the stored one as current', async () => {
  renderBusiness(vi.fn().mockResolvedValue(jsonResponse(200, TWO_LANGUAGES)))

  const group = await screen.findByRole('radiogroup', { name: 'Language' })
  expect(group).toBeInTheDocument()
  expect(screen.getByRole('radio', { name: 'English' })).toHaveAttribute('aria-checked', 'true')
  expect(screen.getByRole('radio', { name: 'Deutsch' })).toHaveAttribute('aria-checked', 'false')
})

test('tapping Deutsch saves at once with PUT {language: de} and shows what the API answered', async () => {
  const user = userEvent.setup()
  const puts: unknown[] = []
  const fetchMock = vi.fn((_url: string, init?: RequestInit) => {
    if (init?.method === 'PUT') {
      puts.push(JSON.parse(String(init.body)))
      return Promise.resolve(jsonResponse(200, { language: 'de', selectable_languages: ['en', 'de'] }))
    }
    return Promise.resolve(jsonResponse(200, TWO_LANGUAGES))
  })
  renderBusiness(fetchMock)

  await user.click(await screen.findByRole('radio', { name: 'Deutsch' }))

  expect(puts).toEqual([{ language: 'de' }])
  await waitFor(() => {
    expect(screen.getByRole('radio', { name: 'Deutsch' })).toHaveAttribute('aria-checked', 'true')
  })
  expect(screen.getByRole('radio', { name: 'English' })).toHaveAttribute('aria-checked', 'false')
  expect(screen.queryByText('Discard the name?')).not.toBeInTheDocument()
})

test('segments are disabled while the choice is saving', async () => {
  const user = userEvent.setup()
  const fetchMock = vi.fn((_url: string, init?: RequestInit) =>
    init?.method === 'PUT' ? new Promise<Response>(() => undefined) : Promise.resolve(jsonResponse(200, TWO_LANGUAGES)),
  )
  renderBusiness(fetchMock)

  await user.click(await screen.findByRole('radio', { name: 'Deutsch' }))

  expect(screen.getByRole('radio', { name: 'English' })).toBeDisabled()
  expect(screen.getByRole('radio', { name: 'Deutsch' })).toBeDisabled()
})

test('a language choice never raises the "Discard the name?" question on close', async () => {
  const user = userEvent.setup()
  const fetchMock = vi.fn((_url: string, init?: RequestInit) =>
    Promise.resolve(
      init?.method === 'PUT'
        ? jsonResponse(200, { language: 'de', selectable_languages: ['en', 'de'] })
        : jsonResponse(200, TWO_LANGUAGES),
    ),
  )
  renderBusiness(fetchMock)

  await user.click(await screen.findByRole('radio', { name: 'Deutsch' }))
  await user.click(await screen.findByRole('button', { name: 'Close' }))

  expect(await screen.findByText('Lista de grupos')).toBeInTheDocument()
})

test('a refusal shows the copy-module sentence, never the detail, and reloads the stored language and the list', async () => {
  const user = userEvent.setup()
  let reloaded = false
  const fetchMock = vi.fn((_url: string, init?: RequestInit) => {
    if (init?.method === 'PUT') {
      return Promise.resolve(
        jsonResponse(422, { code: 'business.language_not_selectable', detail: 'DETAIL-MUST-NOT-SHOW' }),
      )
    }
    if (!reloaded) {
      reloaded = true
      return Promise.resolve(jsonResponse(200, TWO_LANGUAGES))
    }
    return Promise.resolve(jsonResponse(200, { ...BUSINESS, language: 'en', selectable_languages: ['en', 'fr'] }))
  })
  renderBusiness(fetchMock)

  await user.click(await screen.findByRole('radio', { name: 'Deutsch' }))

  expect(await screen.findByRole('alert')).toHaveTextContent("That language isn't available for your business.")
  expect(screen.queryByText(/DETAIL-MUST-NOT-SHOW/)).not.toBeInTheDocument()
  await waitFor(() => {
    expect(screen.queryByRole('radio', { name: 'Deutsch' })).not.toBeInTheDocument()
  })
  expect(screen.queryByRole('radio', { name: 'fr' })).not.toBeInTheDocument()
  expect(screen.getByRole('radio', { name: 'English' })).toHaveAttribute('aria-checked', 'true')
})

test('a stored language off the Selectable list is shown checked, cannot be tapped, and keeps its place in the list', async () => {
  renderBusiness(vi.fn().mockResolvedValue(jsonResponse(200, { ...BUSINESS, language: 'de', selectable_languages: ['en', 'fr'] })))

  const group = await screen.findByRole('radiogroup', { name: 'Language' })
  const radios = within(group).getAllByRole('radio')
  expect(radios.map((radio) => radio.textContent)).toEqual(['English', 'Deutsch'])
  const stored = screen.getByRole('radio', { name: 'Deutsch' })
  expect(stored).toHaveAttribute('aria-checked', 'true')
  expect(stored).toBeDisabled()
  expect(screen.getByRole('radio', { name: 'English' })).toBeEnabled()
  expect(screen.queryByText(/^Current:/)).not.toBeInTheDocument()
})
