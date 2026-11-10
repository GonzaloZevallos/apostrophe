/**
 * `BusinessGroup` at the screen seam (plan, "Business"; `accounts.md`): renaming the
 * business, inline refusals, and the unsaved-changes rule measured against the name the
 * server last accepted. The API is faked at `fetch`, never mocked deeper (CODING_STANDARDS §10).
 */

import { LOGIN, SETTINGS, SETTINGS_BUSINESS } from '../../routes'
import { inAppState } from '../../components/inAppState'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, Outlet, RouterProvider } from 'react-router'
import { afterEach, expect, test, vi } from 'vitest'
import type { StoredLanguage } from '../../api/language'
import type { Me } from '../../api/me'
import { SHOWN_EN } from '../../test/shownLanguage'
import { ERROR_GENERICO_MENSAJE } from '../../components/ErrorGenerico'
import { SIN_CONEXION_MENSAJE } from '../../copy/common'
import { expectIconAndTextRule } from '../../test/iconAndTextRule'
import BusinessGroup from './BusinessGroup'
import { BUSINESS_NAME_INVALID_MESSAGE, GENERIC_REFUSAL_MESSAGE, RENAME_SUCCESS } from '../../copy/settings'

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
}

function Provide() {
  return <Outlet context={ME} />
}

// What `GET /business` lists (the API's order and calling codes, faked at fetch).
const PHONE_COUNTRIES = [
  { code: 'AR', calling_code: '54' },
  { code: 'UY', calling_code: '598' },
  { code: 'CL', calling_code: '56' },
  { code: 'PY', calling_code: '595' },
  { code: 'BR', calling_code: '55' },
  { code: 'MX', calling_code: '52' },
  { code: 'ES', calling_code: '34' },
  { code: 'US', calling_code: '1' },
]

const BUSINESS = {
  phone_country: 'AR',
  phone_countries: PHONE_COUNTRIES,
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

test('shows the business name', async () => {
  renderBusiness(vi.fn().mockResolvedValue(jsonResponse(200, BUSINESS)))

  expect(await screen.findByDisplayValue('La Huerta')).toBeInTheDocument()
})

test('renaming the business shows the fixed success toast, never the name or an id', async () => {
  const fetchMock = vi.fn((_url: string, init?: RequestInit) => {
    if (init?.method === 'PATCH') {
      return Promise.resolve(jsonResponse(200, { ...BUSINESS, name: 'La Huerta Nueva' }))
    }
    return Promise.resolve(jsonResponse(200, BUSINESS))
  })
  renderBusiness(fetchMock)

  const input = await screen.findByLabelText('Business name')
  await userEvent.clear(input)
  await userEvent.type(input, 'La Huerta Nueva')
  await userEvent.click(screen.getByRole('button', { name: 'Save' }))

  expect(await screen.findByText(RENAME_SUCCESS)).toBeInTheDocument()
  expect(screen.getByDisplayValue('La Huerta Nueva')).toBeInTheDocument()
})

test('a rejected name keeps what was typed and shows the inline refusal, not a toast', async () => {
  const fetchMock = vi.fn((_url: string, init?: RequestInit) => {
    if (init?.method === 'PATCH') {
      return Promise.resolve(
        jsonResponse(422, { detail: 'blank', code: 'account.business_name_invalid' }),
      )
    }
    return Promise.resolve(jsonResponse(200, BUSINESS))
  })
  renderBusiness(fetchMock)

  const input = await screen.findByLabelText('Business name')
  await userEvent.clear(input)
  await userEvent.type(input, '   ')
  await userEvent.click(screen.getByRole('button', { name: 'Save' }))

  expect(await screen.findByRole('alert')).toHaveTextContent(BUSINESS_NAME_INVALID_MESSAGE)
  expect(screen.queryByText(RENAME_SUCCESS)).not.toBeInTheDocument()
  expect(input).toHaveValue('   ')
})

test('a dropped network while renaming shows "Sin conexión", never the generic retry', async () => {
  const fetchMock = vi.fn((_url: string, init?: RequestInit) => {
    if (init?.method === 'PATCH') return Promise.reject(new TypeError('network error'))
    return Promise.resolve(jsonResponse(200, BUSINESS))
  })
  renderBusiness(fetchMock)

  const input = await screen.findByLabelText('Business name')
  await userEvent.clear(input)
  await userEvent.type(input, 'La Huerta Nueva')
  await userEvent.click(screen.getByRole('button', { name: 'Save' }))

  expect(await screen.findByText(SIN_CONEXION_MENSAJE)).toBeInTheDocument()
  expect(screen.queryByText(ERROR_GENERICO_MENSAJE)).not.toBeInTheDocument()
  expect(screen.queryByText(RENAME_SUCCESS)).not.toBeInTheDocument()
})

test('"Close" right after a save closes at once, with the refetch still pending: the saved name is not unsaved', async () => {
  let gets = 0
  const fetchMock = vi.fn((_url: string, init?: RequestInit) => {
    if (init?.method === 'PATCH') {
      return Promise.resolve(jsonResponse(200, { ...BUSINESS, name: 'La Huerta Nueva' }))
    }
    gets += 1
    return gets === 1 ? Promise.resolve(jsonResponse(200, BUSINESS)) : new Promise<Response>(() => undefined)
  })
  renderBusiness(fetchMock)

  const input = await screen.findByLabelText('Business name')
  await userEvent.clear(input)
  await userEvent.type(input, 'La Huerta Nueva')
  await userEvent.click(screen.getByRole('button', { name: 'Save' }))
  await screen.findByText(RENAME_SUCCESS)
  await userEvent.click(screen.getByRole('button', { name: 'Close' }))

  expect(await screen.findByText('Lista de grupos')).toBeInTheDocument()
  expect(screen.queryByText('Discard changes?')).not.toBeInTheDocument()
})

test('a real change after a save asks before closing, and keeping it leaves what was typed', async () => {
  const fetchMock = vi.fn((_url: string, init?: RequestInit) => {
    if (init?.method === 'PATCH') {
      return Promise.resolve(jsonResponse(200, { ...BUSINESS, name: 'La Huerta Nueva' }))
    }
    return Promise.resolve(jsonResponse(200, BUSINESS))
  })
  renderBusiness(fetchMock)

  const input = await screen.findByLabelText('Business name')
  await userEvent.clear(input)
  await userEvent.type(input, 'La Huerta Nueva')
  await userEvent.click(screen.getByRole('button', { name: 'Save' }))
  await screen.findByText(RENAME_SUCCESS)
  await userEvent.type(input, ' 2')
  await userEvent.click(screen.getByRole('button', { name: 'Close' }))

  expect(await screen.findByText('Discard changes?')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'No, keep editing' }))
  expect(screen.getByLabelText('Business name')).toHaveValue('La Huerta Nueva 2')
  expect(screen.queryByText('Lista de grupos')).not.toBeInTheDocument()
})

test('an untouched name closes at once', async () => {
  renderBusiness(vi.fn().mockResolvedValue(jsonResponse(200, BUSINESS)))

  await screen.findByDisplayValue('La Huerta')
  await userEvent.click(screen.getByRole('button', { name: 'Close' }))

  expect(await screen.findByText('Lista de grupos')).toBeInTheDocument()
})

test('the group follows the icon and text rule: a text-only submit and a link close', async () => {
  renderBusiness(vi.fn().mockResolvedValue(jsonResponse(200, BUSINESS)))
  await screen.findByDisplayValue('La Huerta')

  expectIconAndTextRule(document.body)
})

const TWO_LANGUAGES = { ...BUSINESS, selectable_languages: ['en', 'de'] }

test('no language control with only English selectable', async () => {
  renderBusiness(vi.fn().mockResolvedValue(jsonResponse(200, BUSINESS)))

  await screen.findByDisplayValue('La Huerta')
  expect(screen.queryByRole('radiogroup', { name: 'Language' })).not.toBeInTheDocument()
})

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
  expect(screen.queryByText('Discard changes?')).not.toBeInTheDocument()
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
  expect(await screen.findByRole('radio', { name: 'fr' })).toBeInTheDocument()
  expect(screen.queryByRole('radio', { name: 'Deutsch' })).not.toBeInTheDocument()
  expect(screen.getByRole('radio', { name: 'English' })).toHaveAttribute('aria-checked', 'true')
})

test('a stored language off the list is one extra selected segment, first, that cannot be tapped', async () => {
  const stored = 'fr' as StoredLanguage
  renderBusiness(vi.fn().mockResolvedValue(jsonResponse(200, { ...TWO_LANGUAGES, language: stored })))

  const radios = within(await screen.findByRole('radiogroup', { name: 'Language' })).getAllByRole('radio')
  expect(radios.map((radio) => radio.textContent)).toEqual(['fr', 'English', 'Deutsch'])
  expect(radios[0]).toHaveAttribute('aria-checked', 'true')
  expect(radios[0]).toBeDisabled()
  expect(radios[1]).toBeEnabled()
})

const OPTION_NAMES = [
  'No country',
  'Argentina (+54)',
  'Uruguay (+598)',
  'Chile (+56)',
  'Paraguay (+595)',
  'Brazil (+55)',
  'Mexico (+52)',
  'Spain (+34)',
  'United States (+1)',
]

function phoneCountryFetch(answer: () => Response | Promise<Response>) {
  return vi.fn((url: string, init?: RequestInit) => {
    if (url === '/business/phone-country' && init?.method === 'PUT') return Promise.resolve(answer())
    return Promise.resolve(jsonResponse(200, BUSINESS))
  })
}

test('the Phone country control lists "No country" first, then the API countries with their codes, and marks the stored one with a check', async () => {
  renderBusiness(vi.fn().mockResolvedValue(jsonResponse(200, BUSINESS)))

  const group = await screen.findByRole('radiogroup', { name: 'Phone country' })
  const options = within(group).getAllByRole('radio')
  expect(options.map((option) => option.textContent)).toEqual(OPTION_NAMES)
  const argentina = screen.getByRole('radio', { name: 'Argentina (+54)' })
  expect(argentina).toHaveAttribute('aria-checked', 'true')
  expect(argentina.querySelector('svg')).not.toBeNull()
  expect(screen.getByRole('radio', { name: 'No country' })).toHaveAttribute('aria-checked', 'false')
})

test('the help line is always visible and is the control\'s accessible description', async () => {
  renderBusiness(vi.fn().mockResolvedValue(jsonResponse(200, BUSINESS)))

  const group = await screen.findByRole('radiogroup', { name: 'Phone country' })
  expect(group).toHaveAccessibleDescription("Applies to numbers you type from now on. Saved numbers don't change.")
})

test('choosing a country and saving sends only PUT {phone_country}, with no confirmation, and shows what the API answered', async () => {
  const user = userEvent.setup()
  const fetchMock = phoneCountryFetch(() => jsonResponse(200, { phone_country: 'UY', phone_countries: PHONE_COUNTRIES }))
  renderBusiness(fetchMock)

  await user.click(await screen.findByRole('radio', { name: 'Uruguay (+598)' }))
  expect(screen.getByRole('radio', { name: 'Uruguay (+598)' })).toHaveAttribute('aria-checked', 'true')
  await user.click(screen.getByRole('button', { name: 'Save' }))

  expect(await screen.findByText(RENAME_SUCCESS)).toBeInTheDocument()
  const writes = fetchMock.mock.calls.filter(([, init]) => init?.method !== undefined && init.method !== 'GET')
  expect(writes.map(([url, init]) => [url, init?.method, init?.body])).toEqual([
    ['/business/phone-country', 'PUT', JSON.stringify({ phone_country: 'UY' })],
  ])
  expect(screen.getByRole('radio', { name: 'Uruguay (+598)' })).toHaveAttribute('aria-checked', 'true')
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
})

test('choosing "No country" saves a null Phone country', async () => {
  const user = userEvent.setup()
  const fetchMock = phoneCountryFetch(() => jsonResponse(200, { phone_country: null, phone_countries: PHONE_COUNTRIES }))
  renderBusiness(fetchMock)

  await user.click(await screen.findByRole('radio', { name: 'No country' }))
  await user.click(screen.getByRole('button', { name: 'Save' }))

  expect(await screen.findByText(RENAME_SUCCESS)).toBeInTheDocument()
  expect(fetchMock).toHaveBeenCalledWith(
    '/business/phone-country',
    expect.objectContaining({ method: 'PUT', body: JSON.stringify({ phone_country: null }) }),
  )
  expect(screen.getByRole('radio', { name: 'No country' })).toHaveAttribute('aria-checked', 'true')
})

test('a refused Phone country shows the fixed generic sentence under the control, never the detail, and keeps the choice', async () => {
  const user = userEvent.setup()
  renderBusiness(
    phoneCountryFetch(() =>
      jsonResponse(422, { code: 'business.phone_country_unknown', detail: 'DETAIL-MUST-NOT-SHOW' }),
    ),
  )

  await user.click(await screen.findByRole('radio', { name: 'Chile (+56)' }))
  await user.click(screen.getByRole('button', { name: 'Save' }))

  expect(await screen.findByRole('alert')).toHaveTextContent(GENERIC_REFUSAL_MESSAGE)
  expect(screen.queryByText(/DETAIL-MUST-NOT-SHOW/)).not.toBeInTheDocument()
  expect(screen.queryByText(RENAME_SUCCESS)).not.toBeInTheDocument()
  expect(screen.getByRole('radio', { name: 'Chile (+56)' })).toHaveAttribute('aria-checked', 'true')
})

test('a dropped network while saving the Phone country shows "Sin conexión"', async () => {
  const user = userEvent.setup()
  const fetchMock = vi.fn((url: string, init?: RequestInit) =>
    url === '/business/phone-country' && init?.method === 'PUT'
      ? Promise.reject(new TypeError('network error'))
      : Promise.resolve(jsonResponse(200, BUSINESS)),
  )
  renderBusiness(fetchMock)

  await user.click(await screen.findByRole('radio', { name: 'Spain (+34)' }))
  await user.click(screen.getByRole('button', { name: 'Save' }))

  expect(await screen.findByText(SIN_CONEXION_MENSAJE)).toBeInTheDocument()
  expect(screen.queryByText(RENAME_SUCCESS)).not.toBeInTheDocument()
})

test('an unsaved Phone country choice asks before closing', async () => {
  const user = userEvent.setup()
  renderBusiness(vi.fn().mockResolvedValue(jsonResponse(200, BUSINESS)))

  await user.click(await screen.findByRole('radio', { name: 'Brazil (+55)' }))
  await user.click(screen.getByRole('button', { name: 'Close' }))

  expect(await screen.findByText('Discard changes?')).toBeInTheDocument()
})
