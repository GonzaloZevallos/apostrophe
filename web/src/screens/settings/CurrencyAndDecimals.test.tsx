/**
 * `CurrencyAndDecimals` at the screen seam (plan, "Currency and decimals form"): the live
 * Example, a save that sets the front's format and the `me` cache, the symbol refusal that keeps
 * what was typed, and the fixed lowering sentence with the Attention icon. The API is faked at
 * `fetch`, never mocked deeper (CODING_STANDARDS §10).
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, beforeEach, expect, test, vi, type Mock } from 'vitest'
import { keys } from '../../api/keys'
import type { Me } from '../../api/me'
import { COMMON_TEXT } from '../../copy/common'
import { SETTINGS_TEXT } from '../../copy/settings'
import { currentMoneyFormat, formatMoney, resetMoneyFormat } from '../../format/money'
import { SETTINGS_CURRENCY } from '../../routes'
import { SHOWN_EN } from '../../test/shownLanguage'
import CurrencyAndDecimals from './CurrencyAndDecimals'

const ME: Me = {
  email: 'vos@lahuerta.com',
  business_name: 'La Huerta',
  today: '2026-10-02',
  shown_language: SHOWN_EN,
  money_format: { symbol: '$', decimals: 0 },
}

const SYMBOL_REFUSAL = 'Use 1 to 4 visible characters, and no two asterisks in a row.'
const LOWERING_REFUSAL = 'Some recorded amounts have more decimals than that, so the decimals stay as they were.'

type FetchMock = Mock<(url: string, init?: RequestInit) => Promise<Response>>

function fetchReturning(response: Response | null): FetchMock {
  return vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(() =>
    Promise.resolve(response ?? jsonResponse(200, {})),
  )
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

beforeEach(() => {
  resetMoneyFormat()
})

afterEach(() => {
  vi.unstubAllGlobals()
  resetMoneyFormat()
})

function renderForm(fetchMock: FetchMock): QueryClient {
  vi.stubGlobal('fetch', fetchMock)
  const queryClient = new QueryClient()
  queryClient.setQueryData(keys.me(), ME)
  const router = createMemoryRouter([{ path: SETTINGS_CURRENCY, element: <CurrencyAndDecimals /> }], {
    initialEntries: [SETTINGS_CURRENCY],
  })
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
  return queryClient
}

function lastPutBody(fetchMock: FetchMock): unknown {
  const call = fetchMock.mock.calls.find(([, init]) => init?.method === 'PUT')
  if (call === undefined) throw new Error('no PUT was sent')
  return JSON.parse(String(call[1]?.body))
}

test('the Example is written from the unsaved symbol and decimals as they are typed', async () => {
  const user = userEvent.setup()
  renderForm(fetchReturning(null))

  expect(screen.getByRole('status')).toHaveTextContent('$ 11.001')

  const symbol = screen.getByRole('textbox', { name: new RegExp(SETTINGS_TEXT.currencySymbol) })
  await user.clear(symbol)
  await user.type(symbol, 'US$')
  await user.click(screen.getByRole('radio', { name: SETTINGS_TEXT.currencyDecimals2 }))

  expect(screen.getByRole('status')).toHaveTextContent('US$ 11.000,50')
})

test('Save sends the symbol and the decimals only, sets the front format and the me cache', async () => {
  const user = userEvent.setup()
  const fetchMock = fetchReturning(jsonResponse(200, { symbol: 'US$', decimals: 0 }))
  const queryClient = renderForm(fetchMock)

  const symbol = screen.getByRole('textbox', { name: new RegExp(SETTINGS_TEXT.currencySymbol) })
  await user.clear(symbol)
  await user.type(symbol, 'US$')
  await user.click(screen.getByRole('button', { name: COMMON_TEXT.save }))

  expect(await screen.findByText(SETTINGS_TEXT.currencySaved)).toBeInTheDocument()
  expect(lastPutBody(fetchMock)).toEqual({ symbol: 'US$', decimals: 0 })
  expect(currentMoneyFormat()).toEqual({ symbol: 'US$', decimals: 0 })
  expect(formatMoney(11000)).toBe('US$ 11.000')
  expect(queryClient.getQueryData<Me>(keys.me())?.money_format).toEqual({ symbol: 'US$', decimals: 0 })
})

test('a symbol refusal shows the API refusal next to the field and keeps what was typed', async () => {
  const user = userEvent.setup()
  const fetchMock = fetchReturning(
    jsonResponse(422, { code: 'money_format.symbol_invalid', field: 'symbol' }),
  )
  renderForm(fetchMock)

  const symbol = screen.getByRole('textbox', { name: new RegExp(SETTINGS_TEXT.currencySymbol) })
  await user.clear(symbol)
  await user.type(symbol, 'a**')
  await user.click(screen.getByRole('button', { name: COMMON_TEXT.save }))

  expect(await screen.findByText(SYMBOL_REFUSAL)).toBeInTheDocument()
  expect(symbol).toHaveValue('a**')
  expect(currentMoneyFormat()).toEqual({ symbol: '$', decimals: 0 })
})

test('a refused lowering shows the fixed sentence with the Attention icon and changes nothing', async () => {
  const user = userEvent.setup()
  const fetchMock = fetchReturning(jsonResponse(409, { code: 'money_format.decimals_below_recorded' }))
  const queryClient = renderForm(fetchMock)

  await user.click(screen.getByRole('radio', { name: SETTINGS_TEXT.currencyDecimals1 }))
  await user.click(screen.getByRole('button', { name: COMMON_TEXT.save }))

  const alert = await screen.findByRole('alert')
  expect(alert).toHaveTextContent(LOWERING_REFUSAL)
  expect(alert.querySelector('svg')).not.toBeNull()
  expect(screen.getByRole('radio', { name: SETTINGS_TEXT.currencyDecimals1 })).toHaveAttribute('aria-checked', 'true')
  expect(currentMoneyFormat()).toEqual({ symbol: '$', decimals: 0 })
  await waitFor(() => {
    expect(queryClient.getQueryData<Me>(keys.me())?.money_format).toEqual({ symbol: '$', decimals: 0 })
  })
})
