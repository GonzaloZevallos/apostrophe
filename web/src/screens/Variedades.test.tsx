/**
 * `Variedades`, its two panes and `VariedadNueva` at the screen seam (`varieties.md`, "The
 * list"), through Testing Library over the app's real route table with `fetch` faked and the
 * viewport faked (`matchMedia`). Every status, price and "Oculta" shown is what the faked
 * API answered: nothing here asks the front to decide one.
 */

import { QueryClient, QueryClientProvider, focusManager } from '@tanstack/react-query'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RouterProvider, createMemoryRouter } from 'react-router'
import { afterEach, describe, expect, test, vi } from 'vitest'
import type { FirstRunAnswer } from '../api/firstRun'
import { router as appRouter } from '../router'
import { renderWithViewport } from '../test-viewport'
import { expectIconAndTextRule, iconAndTextProblems } from '../test/iconAndTextRule'
import {
  CATALOG,
  STOCK as STOCK_PATH,
  STOCK_ENTRY_NEW,
  VARIETIES as VARIETIES_PATH,
  VARIETY,
  VARIETY_NEW,
  WITHDRAWAL_NEW,
  pathTo,
} from '../routes'
import { NO_PRICE_TODAY } from './Variedades'
import { EMPTY_DETAIL, EMPTY_TITLE } from '../copy/varieties'
import { LIMITS, SAMPLES } from '../copy/limits'

const ME = { email: 'ana@x.com', business_name: 'La Huerta', today: '2026-10-02' }

function price(list: number) {
  return { id: 1, effective_from: '2026-09-25', list_price: list, bulk_price: null, bulk_minimum: null }
}

const VARIETIES = [
  { id: 4, name: 'Sir Jack', current_price: price(11000) },
  { id: 2, name: 'Golden Cookies', current_price: price(14000) },
  { id: 3, name: 'Mango Bomb', current_price: null },
  { id: 1, name: '24K Gold', current_price: price(12000) },
]

function stockRow(variety_id: number, patch: Record<string, unknown>) {
  return { variety_id, grams: 0, status: 'ok', sold_out_since: null, threshold: null, days_left: null, ...patch }
}

const STOCK = {
  total: 153,
  varieties: [
    stockRow(1, { grams: 135, status: 'ok', days_left: 270 }),
    stockRow(2, { grams: 18, status: 'low', threshold: 20, days_left: 24 }),
    stockRow(3, { grams: 0, status: 'no_entries' }),
    stockRow(4, { grams: 0, status: 'sold_out', sold_out_since: '2026-10-01' }),
  ],
  entries: [],
}

function catalogOf(hidden: number[]) {
  return {
    text: 'texto',
    header: '',
    footer: '',
    varieties: VARIETIES.map((variety) => ({
      id: variety.id,
      name: variety.name,
      emoji: null,
      indica_share: null,
      aroma: null,
      shown: !hidden.includes(variety.id),
      state: hidden.includes(variety.id) ? 'hidden' : 'in',
    })),
  }
}

const FIRST_RUN_NONE: FirstRunAnswer = { kind: 'none', checklist: [], import_notice: false, nothing_qualifies: false }

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

type Answers = Record<string, () => Response | Promise<Response>>

function defaults(): Answers {
  return {
    'GET /auth/me': () => json(200, ME),
    'GET /varieties': () => json(200, VARIETIES),
    'GET /stock': () => json(200, STOCK),
    'GET /catalog': () => json(200, catalogOf([])),
    'GET /first-run': () => json(200, FIRST_RUN_NONE),
    'GET /varieties/1': () => json(200, VARIETIES[3]),
    'GET /varieties/1/prices': () => json(200, [price(12000)]),
    'GET /varieties/7': () => json(200, { id: 7, name: 'Sir Jack', current_price: null }),
    'GET /varieties/7/prices': () => json(200, []),
  }
}

function renderApp(path: string, { computer = false, answers = {} }: { computer?: boolean; answers?: Answers } = {}) {
  const table = { ...defaults(), ...answers }
  const fetchMock = vi.fn((url: string, init?: RequestInit) => {
    const key = `${init?.method ?? 'GET'} ${url}`
    const answer = table[key]
    if (answer === undefined) return Promise.reject(new Error(`unexpected request: ${key}`))
    return Promise.resolve(answer())
  })
  vi.stubGlobal('fetch', fetchMock)
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const router = createMemoryRouter(appRouter.routes, { initialEntries: [path] })
  renderWithViewport(computer ? 'computer' : 'phone', () =>
    render(
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    ),
  )
  return { router, fetchMock }
}

function writes(fetchMock: ReturnType<typeof vi.fn>): { call: string; body: unknown }[] {
  return fetchMock.mock.calls
    .map(([url, init]) => ({ url: url as string, init: init as RequestInit | undefined }))
    .filter(({ init }) => init?.method !== undefined && init.method !== 'GET')
    .map(({ url, init }) => ({
      call: `${init?.method} ${url}`,
      body: typeof init?.body === 'string' ? (JSON.parse(init.body) as unknown) : undefined,
    }))
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('the list', () => {
  test('lists every variety by name, each with its status by shape and word, detail and price', async () => {
    renderApp(VARIETIES_PATH)

    const rows = await screen.findAllByRole('link', { name: /x g|Sin precio/ })
    expect(rows.map((row) => row.getAttribute('href'))).toEqual([
      pathTo(VARIETY, { id: 1 }),
      pathTo(VARIETY, { id: 2 }),
      pathTo(VARIETY, { id: 3 }),
      pathTo(VARIETY, { id: 4 }),
    ])
    expect(rows[0]).toHaveTextContent('24K Gold')
    expect(rows[0]).toHaveTextContent('ok')
    expect(rows[0]).toHaveTextContent('135 g · 270 días')
    expect(rows[0]).toHaveTextContent('$ 12.000 x g')
    expect(rows[1]).toHaveTextContent('baja')
    expect(rows[1]).toHaveTextContent('18 g · 24 días')
    expect(rows[2]).toHaveTextContent('sin entradas')
    expect(rows[2]).toHaveTextContent('0 g · Cargale la primera entrada')
    expect(rows[2]).toHaveTextContent(NO_PRICE_TODAY)
    expect(rows[3]).toHaveTextContent('agotada')
    expect(rows[3]).toHaveTextContent('0 g · Sin gramos desde el 01/10')
  })

  test('"Oculta" sits beside the status of a hidden variety, never in its place', async () => {
    renderApp(VARIETIES_PATH, { answers: { 'GET /catalog': () => json(200, catalogOf([1])) } })

    const row = (await screen.findByText('24K Gold')).closest('a')
    expect(row).not.toBeNull()
    await waitFor(() => expect(within(row as HTMLElement).getByText('Oculta')).toBeInTheDocument())
    expect(row).toHaveTextContent('ok')
    expect(screen.getAllByText('Oculta')).toHaveLength(1)
  })

  test('the summary line counts what is not ok by word, in stock-status order', async () => {
    renderApp(VARIETIES_PATH)

    expect(await screen.findByText('1 sin entradas · 1 agotada · 1 baja')).toBeInTheDocument()
  })

  test('the summary line says everything is fine when every variety is ok', async () => {
    renderApp(VARIETIES_PATH, {
      answers: {
        'GET /varieties': () => json(200, VARIETIES.slice(0, 2)),
        'GET /stock': () => json(200, { ...STOCK, varieties: [stockRow(4, {}), stockRow(2, {})] }),
      },
    })

    expect(await screen.findByText('2 variedades · todo ok')).toBeInTheDocument()
  })

  test('with no varieties there is no summary line, the fixed empty state, and the actions stay', async () => {
    renderApp(VARIETIES_PATH, {
      answers: {
        'GET /varieties': () => json(200, []),
        'GET /stock': () => json(200, { total: 0, varieties: [], entries: [] }),
      },
    })

    expect(await screen.findByText('Todavía no cargaste ninguna variedad')).toBeInTheDocument()
    expect(screen.queryByText(/todo ok|sin entradas ·/)).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Mandar catálogo' })).toHaveAttribute('href', CATALOG)
    expect(screen.getByRole('link', { name: 'New variety' })).toBeInTheDocument()
  })

  test('the actions lead to the catalog, the entry form, the new variety form and every entry', async () => {
    renderApp(VARIETIES_PATH)

    await screen.findByText('24K Gold')
    expect(screen.getByRole('link', { name: 'Mandar catálogo' })).toHaveAttribute('href', CATALOG)
    expect(screen.getByRole('link', { name: '+ Entrada de stock' })).toHaveAttribute('href', STOCK_ENTRY_NEW)
    expect(screen.getByRole('link', { name: 'New variety' })).toHaveAttribute('href', VARIETY_NEW)
    expect(screen.getByRole('link', { name: /All entries/ })).toHaveAttribute('href', STOCK_PATH)
  })

  test('a secondary "Take from stock" opens the withdrawal form with no variety chosen', async () => {
    renderApp(VARIETIES_PATH)

    await screen.findByText('24K Gold')
    const link = screen.getByRole('link', { name: 'Take from stock' })
    expect(link).toHaveAttribute('href', WITHDRAWAL_NEW)
    expect(link).toHaveClass('boton--suave')
  })

  test('the bar has no Stock tab: Inicio, Ventas, Clientes, Variedades and Más', async () => {
    renderApp(VARIETIES_PATH)

    await screen.findByText('24K Gold')
    const bar = screen.getAllByRole('navigation', { name: 'Navegación' }).at(-1) as HTMLElement
    expect(within(bar).getAllByRole('link').map((link) => link.textContent)).toEqual([
      'Home',
      'Sales',
      'Customers',
      'Varieties',
      'More',
    ])
  })

  test('a failed read shows the generic retry, ', async () => {
    renderApp(VARIETIES_PATH, { answers: { 'GET /stock': () => json(500, { code: 'unknown' }) } })

    expect(await screen.findByText('Something went wrong. Try again.')).toBeInTheDocument()
  })
})

describe('on the phone', () => {
  test('the list never opens a variety on its own', async () => {
    const { router } = renderApp(VARIETIES_PATH, { computer: false })

    await screen.findByText('24K Gold')
    await act(() => Promise.resolve())
    expect(router.state.location.pathname).toBe(VARIETIES_PATH)
  })

  test('opening a variety pushes an entry, and back returns to the list', async () => {
    const { router } = renderApp(VARIETIES_PATH, { computer: false })

    await userEvent.click(await screen.findByRole('link', { name: /Sir Jack/ }))

    expect(router.state.location.pathname).toBe(pathTo(VARIETY, { id: 4 }))
    expect(router.state.historyAction).toBe('PUSH')
    await act(() => router.navigate(-1))
    expect(router.state.location.pathname).toBe(VARIETIES_PATH)
  })

  test('a variety\'s page is shown alone', async () => {
    renderApp(pathTo(VARIETY, { id: 1 }), { computer: false })

    expect(await screen.findByRole('heading', { name: '24K Gold' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Mandar catálogo' })).not.toBeInTheDocument()
  })
})

describe('on a computer: two panes', () => {
  test('opening the list selects the first variety by name, replacing the entry', async () => {
    const { router } = renderApp(VARIETIES_PATH, { computer: true })

    expect(await screen.findByRole('heading', { name: '24K Gold' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe(pathTo(VARIETY, { id: 1 }))
    expect(screen.getByRole('link', { name: 'Mandar catálogo' })).toBeInTheDocument()
    expect(router.state.historyAction).toBe('REPLACE')
  })

  test('picking another variety replaces the selection, both panes stay', async () => {
    const { router } = renderApp(VARIETIES_PATH, { computer: true })
    await screen.findByRole('heading', { name: '24K Gold' })

    await userEvent.click(screen.getByRole('link', { name: /Sir Jack/ }))

    expect(router.state.location.pathname).toBe(pathTo(VARIETY, { id: 4 }))
    expect(screen.getByRole('link', { name: 'Mandar catálogo' })).toBeInTheDocument()
    expect(router.state.historyAction).toBe('REPLACE')
  })

  test('a direct link to a variety shows the list beside its page', async () => {
    renderApp(pathTo(VARIETY, { id: 7 }), { computer: true })

    expect(await screen.findByRole('heading', { name: 'Sir Jack' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Mandar catálogo' })).toBeInTheDocument()
    expect(screen.getByText('24K Gold')).toBeInTheDocument()
  })

  test('while the list loads nothing is selected', async () => {
    const { router } = renderApp(VARIETIES_PATH, {
      computer: true,
      answers: { 'GET /varieties': () => new Response(null, { status: 200 }) },
    })

    await act(() => Promise.resolve())
    expect(router.state.location.pathname).toBe(VARIETIES_PATH)
  })

  test('with no varieties nothing is selected and the right pane holds no figure', async () => {
    const { router } = renderApp(VARIETIES_PATH, {
      computer: true,
      answers: {
        'GET /varieties': () => json(200, []),
        'GET /stock': () => json(200, { total: 0, varieties: [], entries: [] }),
      },
    })

    expect(await screen.findByText('Todavía no cargaste ninguna variedad')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe(VARIETIES_PATH)
    expect(screen.getAllByRole('heading').map((heading) => heading.textContent)).toEqual(['Varieties'])
  })

  test('Back from a form opened over the page returns to the variety, both panes still there', async () => {
    const { router } = renderApp(pathTo(VARIETY, { id: 7 }), { computer: true })
    await screen.findByRole('heading', { name: 'Sir Jack' })

    await userEvent.click(screen.getByRole('button', { name: 'Editar nombre' }))
    expect(await screen.findByRole('button', { name: 'Close' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Close' }))

    await waitFor(() => expect(screen.queryByRole('button', { name: 'Close' })).not.toBeInTheDocument())
    expect(router.state.location.pathname).toBe(pathTo(VARIETY, { id: 7 }))
    expect(screen.getByRole('link', { name: 'Mandar catálogo' })).toBeInTheDocument()
  })
})

describe('removing the selected variety on a computer', () => {
  type Action = 'archive' | 'delete'
  type Position = 'in the middle' | 'the last by name' | 'the only one'

  // Ids do not follow name order, and Spanish order (Ácido, bubba, Critical, Zkittlez) differs
  // from code-unit order, so a sort or id-order bug shows.
  const ACIDO = { id: 3, name: 'Ácido', current_price: null }
  const BUBBA = { id: 1, name: 'bubba', current_price: null }
  const CRITICAL = { id: 4, name: 'Critical', current_price: null }
  const ZKITTLEZ = { id: 2, name: 'Zkittlez', current_price: null }
  const BY_NAME = [ACIDO, BUBBA, CRITICAL, ZKITTLEZ]

  const WORDS = {
    archive: { button: 'Archivar variedad', confirm: 'Sí, archivala', toast: 'Variedad archivada' },
    delete: { button: 'Eliminar variedad', confirm: 'Sí, eliminala', toast: 'Variedad eliminada' },
  }

  /** The left pane's links to the given variety. By href: a row's accessible name starts with its
   * status word, so a name matcher anchored on the variety's name would never find it. */
  function linksTo(variety: { id: number }) {
    const href = pathTo(VARIETY, { id: variety.id })
    return screen.queryAllByRole('link').filter((link) => link.getAttribute('href') === href)
  }

  /** The faked API for one removal: the list before the write, the same list without the removed
   * variety after it (never reordered), and the write itself. */
  function answersFor(action: Action, list: typeof BY_NAME, removed: { id: number; name: string }): Answers {
    let written = false
    const remaining = () => (written ? list.filter((variety) => variety.id !== removed.id) : list)
    const answers: Answers = {
      'GET /varieties': () => json(200, remaining()),
      'GET /stock': () =>
        json(200, {
          total: 0,
          varieties: remaining().map((variety) => stockRow(variety.id, { status: 'no_entries' })),
          entries: [],
        }),
      'GET /varieties?archived=true': () =>
        json(200, written && action === 'archive' ? [{ ...removed, archived: true, current_price: null }] : []),
    }
    for (const variety of list) {
      answers[`GET /varieties/${variety.id}`] = () => json(200, { ...variety, archived: false, removal: action })
      answers[`GET /varieties/${variety.id}/prices`] = () => json(200, [])
    }
    if (action === 'archive') {
      answers[`POST /varieties/${removed.id}/archive`] = () => {
        written = true
        return json(200, { ...removed, current_price: null, archived: true, removal: null })
      }
    } else {
      answers[`DELETE /varieties/${removed.id}`] = () => {
        written = true
        return new Response(null, { status: 204 })
      }
    }
    return answers
  }

  const ROWS: [Action, Position][] = [
    ['archive', 'in the middle'],
    ['archive', 'the last by name'],
    ['archive', 'the only one'],
    ['delete', 'in the middle'],
    ['delete', 'the last by name'],
    ['delete', 'the only one'],
  ]

  test.each(ROWS)('%s %s selects the next by name, else the previous one, else nothing', async (action, position) => {
    const removed = position === 'in the middle' ? BUBBA : position === 'the last by name' ? ZKITTLEZ : ACIDO
    const list = position === 'the only one' ? [ACIDO] : BY_NAME
    const { router } = renderApp(pathTo(VARIETY, { id: removed.id }), {
      computer: true,
      answers: answersFor(action, list, removed),
    })

    // On a computer the left pane's mounted GET /varieties query is the cache `leave()` reads, so
    // waiting for every row here is what makes the next-by-name branch the one under test.
    await waitFor(() => {
      const paths = list.map((variety) => pathTo(VARIETY, { id: variety.id }))
      const shown = screen.getAllByRole('link').filter((link) => paths.includes(link.getAttribute('href') ?? ''))
      expect(shown.map((link) => link.getAttribute('href'))).toEqual(paths)
    })
    // The matcher must be able to see the row before its absence means anything.
    expect(linksTo(removed)).toHaveLength(1)
    await userEvent.click(await screen.findByRole('button', { name: WORDS[action].button }))
    await userEvent.click(screen.getByRole('button', { name: WORDS[action].confirm }))

    const expected = position === 'the only one' ? VARIETIES_PATH : pathTo(VARIETY, { id: CRITICAL.id })
    await waitFor(() => expect(router.state.location.pathname).toBe(expected))

    if (position === 'the only one') {
      expect(await screen.findByText(EMPTY_TITLE)).toBeInTheDocument()
    } else {
      expect(linksTo(removed)).toHaveLength(0)
    }
    expect(router.state.historyAction).toBe('REPLACE')
    expect(await screen.findByText(WORDS[action].toast)).toBeInTheDocument()
    expect(screen.queryByText(/Eso ya no está/)).not.toBeInTheDocument()
  })
})

describe('the icon and text rule', () => {
  test('the list screen follows the rule: its actions carry an icon and keep their word as name', async () => {
    renderApp(VARIETIES_PATH)
    await screen.findByText('24K Gold')

    expectIconAndTextRule(screen.getByRole('main'), { optionClasses: ['variedad-fila', 'variedades__todas'] })
    for (const name of ['Mandar catálogo', '+ Entrada de stock', 'Take from stock']) {
      const link = screen.getByRole('link', { name })
      expect(link.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
    }
  })

  test('the rule helper rejects the list screen when an action loses its icon', async () => {
    renderApp(VARIETIES_PATH)
    await screen.findByText('24K Gold')
    screen.getByRole('link', { name: 'Take from stock' }).querySelector('svg')?.remove()

    const problems = iconAndTextProblems(screen.getByRole('main'), { optionClasses: ['variedad-fila', 'variedades__todas'] })
    expect(problems).toHaveLength(1)
    expect(problems[0]).toContain('Take from stock')
  })

  test('the empty list screen follows the rule too', async () => {
    renderApp(VARIETIES_PATH, {
      answers: {
        'GET /varieties': () => json(200, []),
        'GET /stock': () => json(200, { total: 0, varieties: [], entries: [] }),
      },
    })
    await screen.findByText('Todavía no cargaste ninguna variedad')

    expectIconAndTextRule(screen.getByRole('main'), {
      optionClasses: ['variedades__todas'],
      limits: LIMITS,
      samples: SAMPLES,
    })
    expect(screen.getByText(EMPTY_TITLE)).toHaveAttribute('data-copy', 'emptyTitle')
    expect(screen.getByText(EMPTY_DETAIL)).toHaveAttribute('data-copy', 'emptyLine')
  })

  test('the limits check rejects an empty state longer than its limit', async () => {
    renderApp(VARIETIES_PATH, {
      answers: {
        'GET /varieties': () => json(200, []),
        'GET /stock': () => json(200, { total: 0, varieties: [], entries: [] }),
      },
    })
    const title = await screen.findByText(EMPTY_TITLE)
    title.textContent = 'x'.repeat(LIMITS.emptyTitle + 1)

    const problems = iconAndTextProblems(screen.getByRole('main'), { limits: LIMITS, samples: SAMPLES })
    expect(problems.filter((problem) => problem.includes('emptyTitle'))).toHaveLength(1)
  })
})

describe('New variety', () => {
  test('saves the name, says "Variedad guardada" and goes back to the list', async () => {
    const { router, fetchMock } = renderApp(VARIETIES_PATH, {
      answers: { 'POST /varieties': () => json(201, { id: 9, name: 'Sour Diesel', current_price: null }) },
    })
    await userEvent.click(await screen.findByRole('link', { name: 'New variety' }))

    await userEvent.type(await screen.findByPlaceholderText('Nombre de la variedad'), 'Sour Diesel')
    fetchMock.mockClear()
    await userEvent.click(screen.getByRole('button', { name: 'Agregá la variedad' }))

    expect(await screen.findByText('Variedad guardada')).toBeInTheDocument()
    expect(writes(fetchMock)).toEqual([{ call: 'POST /varieties', body: { name: 'Sour Diesel' } }])
    expect(router.state.location.pathname).toBe(VARIETIES_PATH)
  })

  test('a refusal shows under the name and keeps what was typed', async () => {
    renderApp(VARIETY_NEW, {
      answers: { 'POST /varieties': () => json(409, { code: 'variety.name_taken' }) },
    })

    await userEvent.type(await screen.findByPlaceholderText('Nombre de la variedad'), 'Sir Jack')
    await userEvent.click(screen.getByRole('button', { name: 'Agregá la variedad' }))

    expect(await screen.findByText('Ya existe una variedad con ese nombre')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Nombre de la variedad')).toHaveValue('Sir Jack')
  })

  test('a name held by an archived variety shows its own refusal under the name and keeps what was typed', async () => {
    renderApp(VARIETY_NEW, {
      answers: { 'POST /varieties': () => json(409, { code: 'variety.name_archived' }) },
    })

    await userEvent.type(await screen.findByPlaceholderText('Nombre de la variedad'), 'Sir Jack')
    await userEvent.click(screen.getByRole('button', { name: 'Agregá la variedad' }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Ese nombre es de una variedad archivada. Buscala en Archivadas.')
    expect(alert.closest('label')).toHaveTextContent('Name')
    expect(screen.getByPlaceholderText('Nombre de la variedad')).toHaveValue('Sir Jack')
  })

  test('"Close" with something typed asks before discarding; with nothing, it just leaves', async () => {
    const { router } = renderApp(VARIETIES_PATH)
    await userEvent.click(await screen.findByRole('link', { name: 'New variety' }))
    await userEvent.type(await screen.findByPlaceholderText('Nombre de la variedad'), 'Sour')

    await userEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(await screen.findByText('¿Descartás la variedad?')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe(VARIETY_NEW)

    await userEvent.click(screen.getByRole('button', { name: 'Yes, discard it' }))
    await waitFor(() => expect(router.state.location.pathname).toBe(VARIETIES_PATH))
  })

  test('a direct link has no history: "Close" goes to the list', async () => {
    const { router } = renderApp(VARIETY_NEW)

    await userEvent.click(await screen.findByRole('button', { name: 'Close' }))

    await waitFor(() => expect(router.state.location.pathname).toBe(VARIETIES_PATH))
  })
})

describe('Nueva variedad and the icon and text rule', () => {
  test('the form keeps its name help within the limit and the rule', async () => {
    renderApp(VARIETY_NEW)

    await screen.findByRole('button', { name: 'Agregá la variedad' })
    expect(document.querySelectorAll('[data-copy="help"]')).toHaveLength(1)
    expectIconAndTextRule(screen.getByRole('main'), { limits: LIMITS })
  })
})

describe('"Mandar catálogo" and the first-run checklist', () => {
  const REASON = 'Cargá una variedad con precio y su stock'
  const CHECKLIST_EMPTY: FirstRunAnswer = {
    kind: 'checklist',
    checklist: [
      { step: 'priced_variety', required: true, done: false },
      { step: 'stock_entry', required: true, done: false },
      { step: 'published', required: false, done: false },
      { step: 'second_user', required: false, done: false },
    ],
    import_notice: false,
    nothing_qualifies: true,
  }

  test('is disabled with its reason in words while the checklist shows and nothing qualifies', async () => {
    renderApp(VARIETIES_PATH, { answers: { 'GET /first-run': () => json(200, CHECKLIST_EMPTY) } })

    const button = await screen.findByRole('button', { name: 'Mandar catálogo' })
    expect(button).toBeDisabled()
    expect(button).toHaveAccessibleDescription(REASON)
    expect(screen.queryByRole('link', { name: 'Mandar catálogo' })).not.toBeInTheDocument()
    expect(document.querySelectorAll('[data-copy="help"]')).toHaveLength(1)
    expectIconAndTextRule(button.closest<HTMLElement>('.variedades__acciones')!, { limits: LIMITS })
  })

  test.each([
    ['the checklist shows and something qualifies', { ...CHECKLIST_EMPTY, nothing_qualifies: false }],
    ['no first-run element shows', FIRST_RUN_NONE],
    ['the Onboarding shows', { ...FIRST_RUN_NONE, kind: 'onboarding' as const }],
  ])('is enabled and has no reason when %s', async (_name, answer) => {
    renderApp(VARIETIES_PATH, { answers: { 'GET /first-run': () => json(200, answer) } })

    await screen.findByText('24K Gold')
    await waitFor(() => expect(screen.getByRole('link', { name: 'Mandar catálogo' })).toHaveAttribute('href', CATALOG))
    expect(screen.queryByText(REASON)).not.toBeInTheDocument()
  })

  test('is enabled while /first-run is pending', async () => {
    renderApp(VARIETIES_PATH, { answers: { 'GET /first-run': () => new Promise<Response>(() => undefined) } })

    await screen.findByText('24K Gold')
    expect(screen.getByRole('link', { name: 'Mandar catálogo' })).toHaveAttribute('href', CATALOG)
    expect(screen.queryByText(REASON)).not.toBeInTheDocument()
  })

  test('is enabled again when a refetch of /first-run fails after an answer', async () => {
    let reads = 0
    renderApp(VARIETIES_PATH, {
      answers: { 'GET /first-run': () => (reads++ === 0 ? json(200, CHECKLIST_EMPTY) : json(500, { code: 'boom' })) },
    })
    expect(await screen.findByRole('button', { name: 'Mandar catálogo' })).toBeDisabled()

    act(() => {
      focusManager.setFocused(false)
      focusManager.setFocused(true)
    })

    expect(await screen.findByRole('link', { name: 'Mandar catálogo' })).toHaveAttribute('href', CATALOG)
    expect(screen.queryByText(REASON)).not.toBeInTheDocument()
  })

  test('is enabled when /first-run fails', async () => {
    renderApp(VARIETIES_PATH, { answers: { 'GET /first-run': () => json(500, { code: 'boom' }) } })

    await screen.findByText('24K Gold')
    expect(screen.getByRole('link', { name: 'Mandar catálogo' })).toHaveAttribute('href', CATALOG)
    expect(screen.queryByText(REASON)).not.toBeInTheDocument()
  })
})
