/**
 * `TimeZoneRoute` at the screen seam (Testing Library, `fetch` faked at the boundary,
 * CODING_STANDARDS §10): the search narrowing the list, the pick moving the preview, one PUT per
 * save, the fixed refusal that never shows the API's `detail`, and the answered day reaching New
 * sale's default date after a save. The preview's instant is the fixture's `now_epoch_ms`
 * (2026-10-02 16:00 UTC): the front reads no clock.
 */

import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, Outlet, RouterProvider } from 'react-router'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { keys } from '../../api/keys'
import { getMe } from '../../api/me'
import type { TimeZoneSettings } from '../../api/timeZone'
import { inAppState } from '../../components/inAppState'
import { SheetRouterProvider } from '../../components/useSheetStack'
import { formatDateShort } from '../../format/dates'
import { SALE_NEW, SETTINGS_BUSINESS, SETTINGS_TIME_ZONE } from '../../routes'
import { SHOWN_EN } from '../../test/shownLanguage'
import { stubViewport } from '../../test-viewport'
import NuevaVenta from '../ventas/NuevaVenta'
import TimeZoneRoute from './TimeZoneRoute'

const SETTINGS: TimeZoneSettings = {
  time_zone: 'America/Argentina/Buenos_Aires',
  time_zones: ['America/Argentina/Buenos_Aires', 'America/Los_Angeles', 'Asia/Tokyo', 'Europe/Madrid'],
  utc_offsets_minutes: [-180, -420, 540, 120],
  now_epoch_ms: Date.UTC(2026, 9, 2, 16, 0),
}

const DETAIL = 'ZoneInfo detail the screen must never show'

interface Calls {
  puts: unknown[]
}

let calls: Calls
let today: string
let refuse: boolean

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

beforeEach(() => {
  calls = { puts: [] }
  today = '2026-10-02'
  refuse = false
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const path = new URL(String(input), 'http://localhost').pathname
      if (path === '/business/time-zone' && init?.method === 'PUT') {
        calls.puts.push(JSON.parse(String(init.body)))
        if (refuse) return Promise.resolve(jsonResponse(422, { code: 'unknown_time_zone', detail: DETAIL }))
        today = '2026-10-03'
        return Promise.resolve(jsonResponse(200, { time_zone: 'Asia/Tokyo', today }))
      }
      if (path === '/business/time-zone') return Promise.resolve(jsonResponse(200, SETTINGS))
      if (path === '/auth/me') {
        return Promise.resolve(
          jsonResponse(200, { email: 'a@x.com', business_name: 'La Huerta', today, shown_language: SHOWN_EN }),
        )
      }
      return Promise.resolve(jsonResponse(200, []))
    }),
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function WithMe() {
  const me = useQuery({ queryKey: keys.me(), queryFn: getMe })
  return me.data === undefined ? null : <Outlet context={me.data} />
}

function renderSheet() {
  stubViewport('phone')
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const router = createMemoryRouter(
    [
      {
        element: <WithMe />,
        children: [
          { path: SETTINGS_BUSINESS, element: <div>Business group</div> },
          { path: SETTINGS_TIME_ZONE, element: <TimeZoneRoute /> },
          { path: SALE_NEW, element: <NuevaVenta /> },
        ],
      },
    ],
    {
      initialEntries: [SETTINGS_BUSINESS, { pathname: SETTINGS_TIME_ZONE, state: inAppState({ pathname: SETTINGS_BUSINESS }) }],
      initialIndex: 1,
    },
  )
  render(
    <QueryClientProvider client={queryClient}>
      <SheetRouterProvider router={router}>
        <RouterProvider router={router} />
      </SheetRouterProvider>
    </QueryClientProvider>,
  )
  return router
}

test('starts on the stored zone, selected, with the local time there', async () => {
  renderSheet()

  const selected = await screen.findByRole('img', { name: 'Selected' })
  expect(within(selected.closest('li') as HTMLElement).getByText('America/Argentina/Buenos_Aires')).toBeInTheDocument()
  expect(screen.getByText('It is 02/10 13:00 there now')).toBeInTheDocument()
  expect(screen.getByRole('searchbox', { name: 'Search time zones' })).toHaveAttribute('autocomplete', 'off')
  expect(screen.getByRole('button', { name: 'More info' })).toHaveAttribute('aria-expanded', 'false')
})

test('searching narrows the list by place, ignoring case and reading _ as a space', async () => {
  renderSheet()
  const search = await screen.findByRole('searchbox', { name: 'Search time zones' })

  await userEvent.type(search, 'LOS angeles')

  const list = screen.getByRole('list', { name: 'Time zones' })
  expect(within(list).getAllByRole('listitem')).toHaveLength(1)
  expect(within(list).getByText('America/Los_Angeles')).toBeInTheDocument()
})

test('a search that matches nothing shows the muted line and no list', async () => {
  renderSheet()
  const search = await screen.findByRole('searchbox', { name: 'Search time zones' })

  await userEvent.type(search, 'zzzz')

  expect(screen.getByText('No time zone matches "zzzz". Try another place.')).toBeInTheDocument()
  expect(screen.queryByRole('list', { name: 'Time zones' })).not.toBeInTheDocument()
})

test('picking a zone moves the check and the local time there', async () => {
  renderSheet()
  await screen.findByText('It is 02/10 13:00 there now')

  await userEvent.click(screen.getByRole('button', { name: 'Asia/Tokyo' }))

  expect(screen.getByText('It is 03/10 01:00 there now')).toBeInTheDocument()
  const selected = screen.getByRole('img', { name: 'Selected' })
  expect(within(selected.closest('li') as HTMLElement).getByText('Asia/Tokyo')).toBeInTheDocument()
})

test('Save sends one PUT with the chosen zone and closes the sheet', async () => {
  renderSheet()
  await userEvent.click(await screen.findByRole('button', { name: 'Asia/Tokyo' }))

  await userEvent.click(screen.getByRole('button', { name: 'Save time zone' }))

  expect(await screen.findByText('Business group')).toBeInTheDocument()
  expect(calls.puts).toEqual([{ time_zone: 'Asia/Tokyo' }])
})

test('the refusal shows its fixed message with its icon, never the API detail', async () => {
  refuse = true
  renderSheet()
  await userEvent.click(await screen.findByRole('button', { name: 'Asia/Tokyo' }))

  await userEvent.click(screen.getByRole('button', { name: 'Save time zone' }))

  const alert = await screen.findByRole('alert')
  expect(alert).toHaveTextContent("That time zone can't be used. Pick another one from the list.")
  expect(alert.querySelector('svg')).not.toBeNull()
  expect(screen.queryByText(DETAIL)).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Save time zone' })).toBeEnabled()
})

test('after a save, New sale opens on the day the API answered', async () => {
  const router = renderSheet()
  await userEvent.click(await screen.findByRole('button', { name: 'Asia/Tokyo' }))
  await userEvent.click(screen.getByRole('button', { name: 'Save time zone' }))
  await screen.findByText('Business group')

  await router.navigate(SALE_NEW)

  expect(await screen.findByLabelText('Date')).toHaveValue('2026-10-03')
  expect(screen.getByText(`Today ${formatDateShort('2026-10-03')}`)).toBeInTheDocument()
})
