/**
 * "Exactly one ‹ per card" (GH-135, navigation.md, "Chrome and back"), through the real route
 * table, the real `Shell` and every card screen, with the API faked at `fetch`: on a phone and on a
 * computer (its two-pane details included) a card shows one "‹ <parent>" button, the shell's, and
 * none on the price form behind its modal. Then the rows of navigation.md's back table this
 * change touches, each with no history to go back to.
 */

import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import ACCOUNT from '../api/fixtures/account.json'
import CUSTOMER_FIXTURE from '../api/fixtures/customer.json'
import SALE_DETAIL from '../api/fixtures/sale-detail.json'
import WITHDRAWAL_FIXTURE from '../api/fixtures/withdrawal.json'
import App from '../App'
import { queryClient } from '../queryClient'
import { router } from '../router'
import {
  ARCHIVED_VARIETIES,
  CATALOG,
  CUSTOMER,
  HOME,
  SALE,
  SETTINGS,
  STOCK,
  VARIETIES,
  VARIETY,
  VARIETY_ENTRIES,
  VARIETY_PRICES,
  VARIETY_PRICE_NEW,
  WITHDRAWAL,
  pathTo,
} from '../routes'

const viewport = vi.hoisted(() => ({ current: 'phone' as 'phone' | 'computer' }))

vi.mock('./useViewport', () => ({ useViewport: () => viewport.current }))

const ME = { email: 'ana@x.com', business_name: 'La Huerta', today: '2026-10-02' }
const LIVE = { id: 1, name: '24K Gold', archived: false, removal: null, current_price: null }
const ARCHIVED = { id: 2, name: 'Vieja', archived: true, removal: null, current_price: null }
const FIRST_RUN_NONE = { kind: 'none', checklist: [], import_notice: false, nothing_qualifies: false }
const CATALOG_ANSWER = { text: null, header: '', footer: '', varieties: [] }

function json(body: unknown, status = 200): Promise<Response> {
  return Promise.resolve(
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }),
  )
}

/** The faked API: varieties 1 (live) and 2 (archived), a customer, a sale and a withdrawal. */
function answer(input: RequestInfo | URL): Promise<Response> {
  const url = String(input)
  const [path = '', query = ''] = url.split('?')
  if (path === '/auth/me') return json(ME)
  if (path === '/varieties') return json(query.includes('archived=true') ? [ARCHIVED] : [LIVE])
  if (path === '/varieties/1') return json(LIVE)
  if (path === '/varieties/2') return json(ARCHIVED)
  if (/^\/varieties\/\d+\/prices$/.test(path)) return json([])
  if (path === '/stock') return json({ total: 0, varieties: [], entries: [] })
  if (/^\/stock\/varieties\/\d+\/movements$/.test(path)) return json([])
  if (path === '/catalog') return json(CATALOG_ANSWER)
  if (path === '/catalog/archived') return json([])
  if (path === '/first-run') return json(FIRST_RUN_NONE)
  if (path === '/pricing-settings') return json({ is_bulk_pricing: true, is_vip_customers: true })
  if (path === '/customers') return json([])
  if (path === '/customers/1') return json(CUSTOMER_FIXTURE)
  if (path === '/customers/1/account') return json(ACCOUNT)
  if (path === '/sales/1') return json(SALE_DETAIL)
  if (path === '/withdrawals/1') return json(WITHDRAWAL_FIXTURE)
  return json({ code: 'not_found' }, 404)
}

beforeEach(() => {
  viewport.current = 'phone'
  vi.stubGlobal('fetch', vi.fn(answer))
})

afterEach(async () => {
  // Let the card's own requests land while the API is still faked, so a late answer or the
  // navigation it triggers cannot reach the next test's route.
  await waitFor(() => expect(queryClient.isFetching()).toBe(0))
  await act(() => router.navigate(HOME))
  await waitFor(() => expect(queryClient.isFetching()).toBe(0))
  queryClient.clear()
  vi.unstubAllGlobals()
})

async function open(path: string): Promise<void> {
  await act(() => router.navigate(path))
  render(<App />)
}

function arrows(): string[] {
  return screen.queryAllByRole('button', { name: /^‹ / }).map((button) => button.textContent ?? '')
}

/** Every control that reads as a way back, whatever its role: a "‹ …" link or button, or a "Volver". */
function backControls(): string[] {
  return [...screen.queryAllByRole('button'), ...screen.queryAllByRole('link')]
    .map((control) => control.textContent?.trim() ?? '')
    .filter((text) => text.startsWith('‹') || /^Volver\b/.test(text))
}

/** Waits for the card's data to be in, so a card that draws a second arrow once loaded is caught. */
async function settled(): Promise<void> {
  await waitFor(() => expect(arrows().length).toBeGreaterThan(0))
  await waitFor(() => expect(queryClient.isFetching()).toBe(0))
}

const CARDS: [string, string, string][] = [
  ['a customer', pathTo(CUSTOMER, { id: 1 }), '‹ Clientes'],
  ['a live variety', pathTo(VARIETY, { id: 1 }), '‹ Variedades'],
  ['an archived variety', pathTo(VARIETY, { id: 2 }), '‹ Archivadas'],
  ['Archivadas', ARCHIVED_VARIETIES, '‹ Variedades'],
  ['Catálogo', CATALOG, '‹ Variedades'],
  ['Todas las entradas', STOCK, '‹ Variedades'],
  ["a variety's prices", pathTo(VARIETY_PRICES, { id: 1 }), '‹ 24K Gold'],
  ["a variety's entries", pathTo(VARIETY_ENTRIES, { id: 1 }), '‹ 24K Gold'],
  ["a withdrawal's detail", pathTo(WITHDRAWAL, { id: 1 }), '‹ Variedades'],
  ['a sale', pathTo(SALE, { id: 1 }), '‹ Ventas'],
  ['Configuración', SETTINGS, '‹ Más'],
]

describe.each(['phone', 'computer'] as const)('on a %s', (size) => {
  test.each(CARDS)('%s shows exactly one "‹", the shell\'s', async (_name, path, label) => {
    viewport.current = size
    await open(path)
    await settled()

    // The label settles with the record (an archived variety first reads "‹ Variedades").
    if (size === 'computer' && label === '‹ Más') expect(arrows()).toHaveLength(1)
    else await waitFor(() => expect(arrows()).toEqual([label]))
    await waitFor(() => expect(document.querySelectorAll('.flecha-atras')).toHaveLength(1))
    expect(backControls()).toHaveLength(1)
  })
})

test('the price form on a computer, behind its modal, shows no "‹" at all', async () => {
  viewport.current = 'computer'
  await open(pathTo(VARIETY_PRICE_NEW, { id: 1 }))
  await waitFor(() => expect(queryClient.isFetching()).toBe(0))

  expect(arrows()).toEqual([])
  expect(backControls()).toEqual([])
  expect(document.querySelectorAll('.flecha-atras')).toHaveLength(0)
})

describe('back with no history', () => {
  async function tapBack(path: string): Promise<void> {
    await open(path)
    await settled()
    await userEvent.setup().click(screen.getByRole('button', { name: /^‹ / }))
  }

  test("an archived variety's page goes to Archivadas", async () => {
    await tapBack(pathTo(VARIETY, { id: 2 }))
    await waitFor(() => expect(router.state.location.pathname).toBe(ARCHIVED_VARIETIES))
  })

  test('Archivadas goes to Variedades', async () => {
    await tapBack(ARCHIVED_VARIETIES)
    await waitFor(() => expect(router.state.location.pathname).toBe(VARIETIES))
  })

  test("a withdrawal's detail goes to Variedades", async () => {
    await tapBack(pathTo(WITHDRAWAL, { id: 1 }))
    await waitFor(() => expect(router.state.location.pathname).toBe(VARIETIES))
  })

  test('"Ver todas" the entries goes to the variety\'s page', async () => {
    await tapBack(pathTo(VARIETY_ENTRIES, { id: 1 }))
    await waitFor(() => expect(router.state.location.pathname).toBe(pathTo(VARIETY, { id: 1 })))
  })

  test('"Ver todas" the prices goes to the variety\'s page', async () => {
    await tapBack(pathTo(VARIETY_PRICES, { id: 1 }))
    await waitFor(() => expect(router.state.location.pathname).toBe(pathTo(VARIETY, { id: 1 })))
  })
})
