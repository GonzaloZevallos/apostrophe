/**
 * An Archivadas row (`varieties.md`, "Archivadas"; `Archivadas.dc.html`): the name, "Archivada"
 * as the neutral Insignia, "Oculta" only when the stored values say hidden, the grams as a
 * plain figure at zero and below, and "Restaurar"; no status mark, detail line, days left or
 * price. And what a restore keeps: every value read back after it is the one stored before it.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Outlet, RouterProvider, createMemoryRouter } from 'react-router'
import { afterEach, describe, expect, test, vi } from 'vitest'
import type { Me } from '../../api/me'
import FlashProvider from '../../flash/FlashProvider'
import { ARCHIVED_VARIETIES, VARIETIES, VARIETY, pathTo, relative } from '../../routes'
import Variedades from '../Variedades'
import ArchivedVarieties from './ArchivedVarieties'
import VarietyPage from './VarietyPage'
import VarietyRoute from './VarietyRoute'

const ME: Me = { email: 'ana@x.com', business_name: 'La Huerta', today: '2026-10-02' }

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

interface Stored {
  shown: boolean
  emoji: string | null
  indica_share: number | null
  aroma: string | null
}

interface Fake {
  id: number
  name: string
  grams: number
  stored: Stored
}

const HIDDEN: Stored = { shown: false, emoji: '🍪', indica_share: 70, aroma: 'Galletita' }
const SHOWN: Stored = { shown: true, emoji: '🍋', indica_share: 30, aroma: 'Limón' }
const BARE: Stored = { shown: true, emoji: null, indica_share: null, aroma: null }

/** One price entry in force and one stock entry: stored with the variety, never changed by a restore. */
const PRICE = { id: 11, effective_from: '2026-09-06', list_price: 13000, bulk_price: null, bulk_minimum: null, vip_price: null }
const ENTRY = {
  kind: 'entry',
  id: 21,
  date: '2026-09-06',
  variety_id: 0,
  origin: 'opening_stock',
  grams: 20,
  total_cost: 80000,
  cost_per_gram: 4000,
  note: null,
}

/** A small stateful API: the archived flag lives in it, the rest never changes on a restore. */
function fakeApi(fakes: Fake[]) {
  const restored = new Set<number>()
  const detail = (fake: Fake) => ({
    id: fake.id,
    name: fake.name,
    archived: !restored.has(fake.id),
    removal: restored.has(fake.id) ? 'archive' : null,
    current_price: PRICE,
  })
  const row = (fake: Fake) => ({
    variety_id: fake.id,
    grams: fake.grams,
    status: fake.grams > 0 ? 'low' : 'sold_out',
    sold_out_since: null,
    threshold: 20,
    days_left: 3,
  })
  const archived = () => fakes.filter((fake) => !restored.has(fake.id))
  const live = () => fakes.filter((fake) => restored.has(fake.id))
  const answers: Record<string, () => Response> = {
    'GET /varieties?archived=true': () => json(200, archived().map(detail)),
    'GET /varieties': () => json(200, live().map(detail)),
    'GET /stock?archived=true': () => json(200, { total: 0, varieties: archived().map(row), entries: [] }),
    'GET /stock': () => json(200, { total: 0, varieties: live().map(row), entries: [] }),
    'GET /pricing-settings': () => json(200, { is_bulk_pricing: true, is_vip_customers: true }),
    'GET /catalog': () =>
      json(200, {
        text: null,
        header: '',
        footer: '',
        varieties: live().map((fake) => ({ id: fake.id, name: fake.name, ...fake.stored, state: 'in' })),
      }),
  }
  for (const fake of fakes) {
    answers[`GET /varieties/${fake.id}`] = () => json(200, detail(fake))
    answers[`GET /varieties/${fake.id}/prices`] = () => json(200, [PRICE])
    answers[`GET /stock/varieties/${fake.id}/movements`] = () => json(200, [{ ...ENTRY, variety_id: fake.id }])
    answers[`GET /catalog/varieties/${fake.id}`] = () => json(200, fake.stored)
    answers[`POST /varieties/${fake.id}/restore`] = () => {
      restored.add(fake.id)
      return json(200, detail(fake))
    }
  }
  return answers
}

function renderAt(path: string, fakes: Fake[]) {
  const answers = fakeApi(fakes)
  const fetchMock = vi.fn((url: string, init?: RequestInit) => {
    const answer = answers[`${init?.method ?? 'GET'} ${url}`]
    if (answer === undefined) return Promise.reject(new Error(`unexpected request: ${init?.method ?? 'GET'} ${url}`))
    return Promise.resolve(answer())
  })
  vi.stubGlobal('fetch', fetchMock)
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }),
  })
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const router = createMemoryRouter(
    [
      {
        element: (
          <QueryClientProvider client={queryClient}>
            <FlashProvider>
              <Outlet context={ME} />
            </FlashProvider>
          </QueryClientProvider>
        ),
        children: [
          { path: relative(VARIETIES), element: <Variedades /> },
          { path: relative(ARCHIVED_VARIETIES), element: <ArchivedVarieties /> },
          { path: relative(VARIETY), element: <VarietyRoute render={(id) => <VarietyPage varietyId={id} />} /> },
        ],
      },
    ],
    { initialEntries: [path] },
  )
  render(<RouterProvider router={router} />)
  return { router, fetchMock }
}

function rowOf(name: string): HTMLElement {
  return screen.getByText(name, { selector: '.variedad-fila__nombre' }).closest('.variedad-archivada') as HTMLElement
}

afterEach(() => vi.unstubAllGlobals())

describe('an Archivadas row', () => {
  test('shows the neutral Archivada badge, Oculta only when hidden, and the plain grams', async () => {
    renderAt(ARCHIVED_VARIETIES, [
      { id: 4, name: 'Alfa Vieja', grams: 17, stored: HIDDEN },
      { id: 5, name: 'Beta Vieja', grams: 9, stored: BARE },
    ])
    await screen.findByText('Alfa Vieja')
    const hidden = rowOf('Alfa Vieja')
    expect(await within(hidden).findByText('Oculta')).toBeTruthy()
    expect(within(hidden).getByText('Archivada')).toHaveClass('insignia')
    expect(within(hidden).getByText('Archivada')).not.toHaveClass('insignia--acento', 'insignia--deuda', 'insignia--critico')
    expect(within(hidden).getByText('Archivada')).not.toBe(within(hidden).getByText('Oculta'))
    expect(within(hidden).getByText('17 g')).toBeTruthy()
    expect(within(hidden).getByRole('button', { name: 'Restaurar' })).toBeTruthy()

    const shown = rowOf('Beta Vieja')
    expect(await within(shown).findByText('9 g')).toBeTruthy()
    expect(within(shown).queryByText('Oculta')).toBeNull()
  })

  test('shows the grams at zero and below zero with a minus sign, and no status, days left or price', async () => {
    renderAt(ARCHIVED_VARIETIES, [
      { id: 4, name: 'Alfa Vieja', grams: 0, stored: BARE },
      { id: 5, name: 'Beta Vieja', grams: -3, stored: BARE },
    ])
    await screen.findByText('Alfa Vieja')
    expect(await within(rowOf('Alfa Vieja')).findByText('0 g')).toBeTruthy()
    expect(await within(rowOf('Beta Vieja')).findByText('-3 g')).toBeTruthy()
    const main = screen.getByRole('main')
    expect(main.querySelector('.marca-estado')).toBeNull()
    expect(within(main).queryByText(/Agotada|Stock bajo|días|\$/)).toBeNull()
  })
})

describe.each([
  { label: 'hidden', stored: HIDDEN },
  { label: 'shown', stored: SHOWN },
])('Restaurar on a row of a $label variety keeps what was stored', ({ stored }) => {
  test('the live page reads the same flag, stock, threshold and catalog values afterwards', async () => {
    const user = userEvent.setup()
    const { router } = renderAt(ARCHIVED_VARIETIES, [{ id: 4, name: 'Alfa Vieja', grams: 18, stored }])
    await screen.findByText('Alfa Vieja')
    await user.click(within(rowOf('Alfa Vieja')).getByRole('button', { name: 'Restaurar' }))
    expect(await screen.findByText('Variedad restaurada')).toBeTruthy()
    expect(await screen.findByText('No tenés variedades archivadas')).toBeTruthy()

    await router.navigate(pathTo(VARIETY, { id: 4 }))

    expect(await screen.findByRole('button', { name: 'Archivar variedad' })).toBeTruthy()
    // Stock and the threshold: the grams on hand and the warning stored with them.
    expect(await screen.findByText('Avisando: quedan 18 g')).toBeTruthy()
    expect(screen.getAllByText('18 g', { exact: false }).length).toBeGreaterThan(0)
    // The stock entry and the price entry, as stored.
    const stock = (await screen.findByRole('heading', { name: 'Stock y entradas' })).closest('section') as HTMLElement
    expect(await within(stock).findByText('06/09 · Stock inicial')).toBeTruthy()
    expect(within(stock).getByText('20 g')).toBeTruthy()
    expect(within(stock).getByText('$ 4.000 el gramo')).toBeTruthy()
    expect(within(stock).getByText('$ 80.000')).toBeTruthy()
    const prices = (await screen.findByRole('heading', { name: 'Precios' })).closest('section') as HTMLElement
    expect(within(prices).getByText('Rige desde 06/09', { exact: false })).toBeTruthy()
    expect(within(prices).getByText('Vigente hoy')).toBeTruthy()
    expect(within(prices).getByText('$ 13.000')).toBeTruthy()
    // The hidden flag and the catalog attributes.
    const catalog = (await screen.findByRole('heading', { name: 'En el catálogo' })).closest('section') as HTMLElement
    expect(within(catalog).getByText(stored.shown ? 'Se muestra' : 'No se muestra')).toBeTruthy()
    expect(within(catalog).getByText(stored.emoji as string)).toBeTruthy()
    expect(within(catalog).getByText(`${stored.indica_share} %`)).toBeTruthy()
    expect(within(catalog).getByText(stored.aroma as string)).toBeTruthy()
    if (stored.shown) expect(screen.queryByText('Oculta')).toBeNull()
    else expect(screen.getByText('Oculta')).toBeTruthy()
  })
})
