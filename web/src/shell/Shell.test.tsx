/**
 * `Shell` at the screen seam, under a memory *data* router: every screen of the registry is
 * mounted as a stub that only says its title, so what the shell draws is the registry's answer
 * for that screen's kind and place, and nothing else (no pathname, no history decides it).
 *
 * The bar is Inicio, Ventas, Clientes, Variedades and Más; the rail is the first four, a
 * divider, Gastos and Análisis, and the business row, with no Más. "+ Nueva venta" is fixed,
 * apart from the tabs, and only a root shows it. A card shows the bar and a "‹ parent" arrow,
 * a form neither. jsdom lays nothing out, so each surface is checked through its markup and
 * `useViewport` is mocked per case for the viewport (its own test owns `matchMedia`).
 */

import { onlineManager, QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, Outlet, RouterProvider, useLocation, useParams, type RouteObject } from 'react-router'
import { afterEach, expect, test, vi } from 'vitest'
import { get } from '../api/client'
import { keys } from '../api/keys'
import type { Me } from '../api/me'
import type { VarietyDetail } from '../api/varieties'
import { expectIconAndTextRule, iconAndTextProblems } from '../test/iconAndTextRule'
import { inAppState } from '../components/inAppState'
import InAppLink from '../components/InAppLink'
import {
  ANALYSIS,
  CUSTOMER,
  CUSTOMERS,
  EXPENSES,
  EXPENSE_NEW,
  HOME,
  MORE,
  SALE,
  SALE_NEW,
  SALES,
  SCREENS,
  SETTINGS,
  SETTINGS_USERS,
  ARCHIVED_VARIETIES,
  VARIETIES,
  VARIETY,
  VARIETY_ENTRIES,
  pathTo,
  type Screen,
} from '../routes'
import type { Variety } from '../screens/Variedades'
import Mas from '../screens/Mas'
import Shell from './Shell'

const ME: Me = { email: 'ana@x.com', business_name: 'La Huerta', today: '2026-10-03' }

const BAR = ['Inicio', 'Ventas', 'Clientes', 'Variedades', 'Más']
const RAIL = ['Inicio', 'Ventas', 'Clientes', 'Variedades', 'Gastos', 'Análisis']

const viewport = vi.hoisted(() => ({ current: 'phone' as 'phone' | 'computer' }))

vi.mock('./useViewport', () => ({ useViewport: () => viewport.current }))

/** The tabs only, in the order they render: drops "Nueva venta" and the business row. */
function tabNames(nav: HTMLElement): string[] {
  return within(nav)
    .getAllByRole('link')
    .map((link) => link.textContent)
    .filter(
      (name): name is string =>
        name !== null && !name.startsWith('Nueva venta') && !name.startsWith('LH'),
    )
}

function Landed() {
  const location = useLocation()
  const inApp = (location.state as { inApp?: boolean } | null)?.inApp
  return <div>{`en ${location.pathname} inApp=${String(inApp)}`}</div>
}

/** A stand-in for Inicio's teaser: an in-app link into a customer's card. */
function Teaser() {
  return <InAppLink to={pathTo(CUSTOMER, { id: 3 })}>Cobrar a Ana</InAppLink>
}

/**
 * A variety's page stand-in: it runs the detail query the real page runs (the same key and
 * function), which is how `useScreenFacts` learns the record's state once it resolves.
 */
function VarietyStub({ title }: { title: string }) {
  const { id } = useParams()
  useQuery({ queryKey: keys.variety(id ?? ''), queryFn: () => get<VarietyDetail>(`/varieties/${id}`) })
  return <div>{title}</div>
}

/** Every registered screen as a leaf; Inicio holds the teaser, Más its real list. */
function leaf(entry: Screen): RouteObject {
  const element =
    entry.id === 'home' ? (
      <Teaser />
    ) : entry.id === 'more' ? (
      <Mas />
    ) : entry.id === 'variety' ? (
      <VarietyStub title={entry.title} />
    ) : (
      <Landed />
    )
  return { path: entry.path, element, handle: { screen: entry.id } }
}

type FetchImpl = (url: string) => Promise<Response>

/** The default network: nothing answers, so a query stays loading. */
const NEVER: FetchImpl = () => new Promise<Response>(() => undefined)

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

function renderShell(
  entries: string[],
  options: { computer?: boolean; index?: number; client?: QueryClient; fetchImpl?: FetchImpl } = {},
) {
  viewport.current = options.computer === true ? 'computer' : 'phone'
  vi.stubGlobal('fetch', vi.fn(options.fetchImpl ?? NEVER))
  const client = options.client ?? new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const router = createMemoryRouter(
    [{ element: <Outlet context={ME} />, children: [{ element: <Shell />, children: SCREENS.map(leaf) }] }],
    { initialEntries: entries, initialIndex: options.index ?? entries.length - 1 },
  )
  const view = render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
  return { router, client, ...view }
}

afterEach(() => {
  vi.unstubAllGlobals()
  onlineManager.setOnline(true)
})

function bar(container: HTMLElement): HTMLElement {
  return container.querySelector('.bar-inferior') as HTMLElement
}

function rail(container: HTMLElement): HTMLElement {
  return container.querySelector('.riel-lateral') as HTMLElement
}

/** The entries a surface marks as the current page. */
function current(nav: HTMLElement): string[] {
  return [...nav.querySelectorAll('[aria-current="page"]')].map((link) => link.textContent ?? '')
}

test('the bar is Inicio, Ventas, Clientes, Variedades and Más, with no Stock', () => {
  const { container } = renderShell([HOME])

  expect(container.querySelectorAll('nav')).toHaveLength(2)
  expect(tabNames(bar(container))).toEqual(BAR)
  expect(within(bar(container)).queryByText('Stock')).not.toBeInTheDocument()
})

test('every bar tab draws an icon and a visible label', () => {
  const { container } = renderShell([HOME])

  for (const link of within(bar(container)).getAllByRole('link')) {
    expect(link.querySelector('svg')).not.toBeNull()
    expect(link.querySelector('span')?.textContent).not.toBe('')
  }
})

test('the rail is "Nueva venta", four tabs, a divider, Gastos and Análisis, then the business row', () => {
  const { container } = renderShell([HOME], { computer: true })

  const entries = [...rail(container).children].map((child) =>
    child.getAttribute('role') === 'separator' ? '---' : (child.textContent ?? ''),
  )
  expect(entries).toEqual([
    'Nueva venta',
    'Inicio',
    'Ventas',
    'Clientes',
    'Variedades',
    '---',
    'Gastos',
    'Análisis',
    'LHLa Huerta',
  ])
  expect(tabNames(rail(container))).toEqual(RAIL)
  expect(within(rail(container)).queryByRole('link', { name: 'Más' })).not.toBeInTheDocument()
})

test('"Nueva venta" is fixed, apart from the tabs, and goes straight to the sale form', () => {
  renderShell([HOME])

  const links = screen.getAllByRole('link', { name: /Nueva venta/ })
  expect(links).toHaveLength(2)
  for (const link of links) {
    expect(link).toHaveAttribute('href', SALE_NEW)
  }
})

test.each([
  ['a root', HOME, true, true, false],
  ['a root that is Gastos', EXPENSES, true, true, false],
  ['a card: a sale', pathTo(SALE, { id: 7 }), true, false, true],
  ['a card: a customer', pathTo(CUSTOMER, { id: 3 }), true, false, true],
  ['a card: a variety', pathTo(VARIETY, { id: 2 }), true, false, true],
  ['a card: Configuración', SETTINGS, true, false, true],
  ['a form: the sale', SALE_NEW, false, false, false],
  ['a form: a Configuración group', SETTINGS_USERS, false, false, false],
  ['a form: the expense', EXPENSE_NEW, false, false, false],
])(
  '%s: bar %s, "Nueva venta" %s, arrow %s, from the leaf screen\'s kind alone',
  (_kind, path, hasBar, hasButton, hasArrow) => {
    const { container } = renderShell([path])

    expect(container.querySelector('.bar-inferior') !== null).toBe(hasBar)
    expect(container.querySelector('.boton-nueva-venta') !== null).toBe(hasButton)
    expect(screen.queryAllByRole('button', { name: /^‹ / }).length > 0).toBe(hasArrow)
    expect(container.querySelector('.riel-lateral')).not.toBeNull()
  },
)

test.each([
  ['a root', HOME, true],
  ['a card: a sale', pathTo(SALE, { id: 7 }), false],
  ['a card: a customer, the detail pane of Clientes', pathTo(CUSTOMER, { id: 3 }), true],
  ['a card: a variety, the detail pane of Variedades', pathTo(VARIETY, { id: 2 }), true],
  ['a card: Configuración', SETTINGS, false],
  ['a form: the sale', SALE_NEW, false],
])('%s: the rail keeps "Nueva venta" %s, as the computer designs draw it', (_kind, path, inRail) => {
  const { container } = renderShell([path], { computer: true })

  expect(within(rail(container)).queryAllByRole('link', { name: /Nueva venta/ }).length > 0).toBe(inRail)
})

test('on a phone a detail pane has no "Nueva venta" at all', () => {
  renderShell([pathTo(VARIETY, { id: 2 })])

  expect(screen.queryAllByRole('link', { name: /Nueva venta/ })).toHaveLength(0)
})

test.each([
  [HOME, 'Inicio', 'Inicio'],
  [SALES, 'Ventas', 'Ventas'],
  [CUSTOMERS, 'Clientes', 'Clientes'],
  [VARIETIES, 'Variedades', 'Variedades'],
  [pathTo(SALE, { id: 7 }), 'Ventas', 'Ventas'],
  [pathTo(CUSTOMER, { id: 3 }), 'Clientes', 'Clientes'],
  [pathTo(VARIETY, { id: 2 }), 'Variedades', 'Variedades'],
])('on %s each surface marks %s alone, with aria-current', (path, barEntry, railEntry) => {
  const { container } = renderShell([path])

  expect(current(bar(container))).toEqual([barEntry])
  expect(current(rail(container))).toEqual([railEntry])
})

test.each([
  [EXPENSES, 'Gastos'],
  [ANALYSIS, 'Análisis'],
])('on %s the phone marks Más and a computer marks its own entry, %s', (path, railEntry) => {
  const { container } = renderShell([path])

  expect(current(bar(container))).toEqual(['Más'])
  expect(current(rail(container))).toEqual([railEntry])
})

test('Más marks Más on the bar and nothing on the rail, which has no Más', () => {
  const { container } = renderShell([MORE])

  expect(current(bar(container))).toEqual(['Más'])
  expect(current(rail(container))).toEqual([])
})

test('Configuración marks Más on the phone and the business row on a computer', () => {
  const { container } = renderShell([SETTINGS])

  const more = within(bar(container)).getByRole('link', { name: 'Más' })
  expect(more).toHaveAttribute('aria-current', 'page')
  expect(current(bar(container))).toEqual(['Más'])
  const row = within(rail(container)).getByRole('link', { name: 'Configuración de La Huerta' })
  expect(row).toHaveAttribute('aria-current', 'page')
  expect(row.className).toMatch(/--activo/)
  expect(current(rail(container))).toEqual(['LHLa Huerta'])
})

test('a customer card marks Clientes however it was reached: from Inicio, after a reload, from a saved link', async () => {
  const user = userEvent.setup()
  const card = pathTo(CUSTOMER, { id: 3 })
  const fromHome = renderShell([HOME])
  await user.click(screen.getByRole('link', { name: 'Cobrar a Ana' }))
  expect(fromHome.router.state.location.pathname).toBe(card)
  expect(current(bar(fromHome.container))).toEqual(['Clientes'])
  expect(current(rail(fromHome.container))).toEqual(['Clientes'])
  fromHome.unmount()

  // A reload keeps the entry but loses nothing the mark reads: only the leaf screen.
  const reloaded = renderShell([card])
  expect(current(bar(reloaded.container))).toEqual(['Clientes'])
  reloaded.unmount()

  // A saved link opens with a history that holds something unrelated before it.
  const saved = renderShell([SALES, card], { index: 1 })
  expect(current(bar(saved.container))).toEqual(['Clientes'])
})

test('the active mark is more than color: aria-current, a distinct class and nothing on the rest', () => {
  renderShell([HOME])

  for (const link of screen.getAllByRole('link', { name: 'Inicio' })) {
    expect(link).toHaveAttribute('aria-current', 'page')
    expect(link.className).toMatch(/--activo/)
  }
  for (const link of screen.getAllByRole('link', { name: 'Clientes' })) {
    expect(link).not.toHaveAttribute('aria-current')
    expect(link.className).not.toMatch(/--activo/)
  }
})

test('the business row leads to Configuración, carrying inApp, one tap from Inicio', async () => {
  const { container } = renderShell([HOME], { computer: true })
  const row = within(rail(container)).getByRole('link', { name: 'Configuración de La Huerta' })

  expect(row).toHaveAttribute('href', SETTINGS)
  expect(row).toHaveTextContent('LH')
  expect(row).toHaveTextContent('La Huerta')
  expect(rail(container).lastElementChild).toBe(row)
  await userEvent.click(row)

  expect(screen.getByText(`en ${SETTINGS} inApp=true`)).toBeInTheDocument()
})

test('the phone reaches Configuración in two taps: the Más tab, then its Configuración entry', async () => {
  const { container } = renderShell([HOME])

  await userEvent.click(within(bar(container)).getByRole('link', { name: 'Más' }))
  await userEvent.click(
    within(screen.getByRole('navigation', { name: 'Más' })).getByRole('link', { name: /^Configuración/ }),
  )

  expect(screen.getByText(`en ${SETTINGS} inApp=true`)).toBeInTheDocument()
})

test('Inicio\'s teaser opens the card with inApp state; the card reads "‹ Clientes" and Back lands on Inicio', async () => {
  const user = userEvent.setup()
  const { router } = renderShell([HOME])

  await user.click(screen.getByRole('link', { name: 'Cobrar a Ana' }))
  expect(router.state.location.state).toEqual(inAppState({ pathname: HOME }))
  await user.click(screen.getByRole('button', { name: '‹ Clientes' }))

  expect(router.state.location.pathname).toBe(HOME)
})

test('a card opened from Clientes reads "‹ Clientes" and Back lands on Clientes', async () => {
  const user = userEvent.setup()
  const { router } = renderShell([CUSTOMERS])
  await act(() => router.navigate(pathTo(CUSTOMER, { id: 3 }), { state: inAppState({ pathname: HOME }) }))

  await user.click(screen.getByRole('button', { name: '‹ Clientes' }))

  expect(router.state.location.pathname).toBe(CUSTOMERS)
})

test('a card opened directly reads "‹ Clientes" and Back goes to Clientes, replacing the entry', async () => {
  const user = userEvent.setup()
  const { router } = renderShell([SALES, pathTo(CUSTOMER, { id: 3 })], { index: 1 })

  await user.click(screen.getByRole('button', { name: '‹ Clientes' }))

  expect(router.state.location.pathname).toBe(CUSTOMERS)
  expect(router.state.historyAction).toBe('REPLACE')
})

test('a sale and a variety read "‹ Ventas" and "‹ Variedades"', () => {
  const sale = renderShell([pathTo(SALE, { id: 7 })])
  expect(screen.getByRole('button', { name: '‹ Ventas' })).toBeInTheDocument()
  sale.unmount()

  renderShell([pathTo(VARIETY, { id: 2 })])
  expect(screen.getByRole('button', { name: '‹ Variedades' })).toBeInTheDocument()
})

test('Configuración\'s list opened directly reads "‹ Más" on the phone and "‹ Inicio" on a computer', async () => {
  const phone = renderShell([SETTINGS])
  expect(screen.getByRole('button', { name: '‹ Más' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: '‹ Inicio' })).not.toBeInTheDocument()
  phone.unmount()

  renderShell([SETTINGS], { computer: true })
  expect(screen.getByRole('button', { name: '‹ Inicio' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: '‹ Más' })).not.toBeInTheDocument()
})

test('a root has no arrow', () => {
  renderShell([CUSTOMERS])
  expect(screen.queryByRole('button', { name: /^‹ / })).not.toBeInTheDocument()
})

test('the bar is a menu of icon + text tabs, none sharing an icon (icon and text rule)', () => {
  const { container } = renderShell([HOME])

  expect(bar(container)).toHaveAttribute('data-menu')
  expectIconAndTextRule(bar(container))
})

test('the rail is a menu too, and no two of its entries share an icon', () => {
  const { container } = renderShell([HOME], { computer: true })

  expect(rail(container)).toHaveAttribute('data-menu')
  // Every entry draws its icon, Gastos and Análisis included; only the business row draws an
  // avatar, not an icon, so it is the one thing that may be left over.
  expect(iconAndTextProblems(rail(container))).toEqual([
    expect.stringContaining('"Configuración de La Huerta" is text only'),
  ])
})

test('a bar that repeats an icon is rejected by the rule', () => {
  const { container } = render(
    <nav data-menu>
      <a href="/a">
        <svg aria-hidden="true">
          <path d="M1 1" />
        </svg>
        <span>Uno</span>
      </a>
      <a href="/b">
        <svg aria-hidden="true">
          <path d="M1 1" />
        </svg>
        <span>Dos</span>
      </a>
    </nav>,
  )
  expect(iconAndTextProblems(container)).toEqual([expect.stringContaining('shares its icon with "Uno"')])
})

// ---------------------------------------------------------------------------------------
// Chrome from the host (GH-135): `chromeOf` resolved through `useScreenFacts`, drawn by Shell.
// ---------------------------------------------------------------------------------------

const CHERRY = { id: 5, name: 'Cherry', archived: false, current_price: null } satisfies Variety
const BEEFSTEAK = { id: 6, name: 'Beefsteak', archived: false, current_price: null } satisfies Variety
const ARCHIVED_5 = { ...CHERRY, archived: true }
const ARCHIVED_6 = { ...BEEFSTEAK, archived: true }

function detailOf(variety: Variety): VarietyDetail {
  return { id: variety.id, name: variety.name, archived: variety.archived, removal: null }
}

/** A client whose caches hold the two lists exactly as the screens key them. */
function clientWith(live: Variety[], archived: Variety[]): QueryClient {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  client.setQueryData(keys.varieties(), live)
  client.setQueryData(keys.archivedVarieties(), archived)
  return client
}

function arrows(): HTMLElement[] {
  return screen.queryAllByRole('button', { name: /^‹/ })
}

function railNuevaVenta(container: HTMLElement): HTMLElement[] {
  return within(rail(container)).queryAllByRole('link', { name: /Nueva venta/ })
}

/** Watches the DOM: every node the shell adds or removes that is an arrow or a "Nueva venta". */
function watchChrome(container: HTMLElement) {
  const flickers: string[] = []
  const observer = new MutationObserver((records) => {
    for (const record of records) {
      for (const node of [...record.addedNodes, ...record.removedNodes]) {
        const text = node.textContent ?? ''
        if (text.includes('‹') || text.includes('Nueva venta')) flickers.push(text)
      }
    }
  })
  observer.observe(container, { childList: true, subtree: true })
  return { flickers, stop: () => observer.disconnect() }
}

test.each([
  ['Clientes', pathTo(CUSTOMER, { id: 3 })],
  ['Variedades', pathTo(VARIETY, { id: 5 })],
])('on a computer %s with a row selected keeps the rail\'s "Nueva venta" and draws no arrow', (_host, path) => {
  const { container } = renderShell([path], { computer: true, client: clientWith([CHERRY], []) })

  expect(railNuevaVenta(container)).toHaveLength(1)
  expect(arrows()).toHaveLength(0)
})

test('on the phone a card shows exactly one arrow and no "Nueva venta"', () => {
  for (const path of [pathTo(CUSTOMER, { id: 3 }), pathTo(VARIETY, { id: 5 }), pathTo(SALE, { id: 7 })]) {
    const view = renderShell([path], { client: clientWith([CHERRY], []) })
    expect(arrows()).toHaveLength(1)
    expect(screen.queryAllByRole('link', { name: /Nueva venta/ })).toHaveLength(0)
    view.unmount()
  }
})

test('Archivadas on a computer, alone, shows its one "‹ Variedades" and no "Nueva venta"', () => {
  const { container } = renderShell([ARCHIVED_VARIETIES], { computer: true })

  expect(arrows().map((arrow) => arrow.textContent)).toEqual(['‹ Variedades'])
  expect(railNuevaVenta(container)).toHaveLength(0)
})

test('Archivadas on a computer beside an archived variety keeps the one "‹ Variedades" and no "Nueva venta"', () => {
  const { container } = renderShell([pathTo(VARIETY, { id: 5 })], {
    computer: true,
    client: clientWith([], [ARCHIVED_5]),
  })

  expect(arrows().map((arrow) => arrow.textContent)).toEqual(['‹ Variedades'])
  expect(railNuevaVenta(container)).toHaveLength(0)
  expect(current(bar(container))).toEqual(['Variedades'])
  expect(current(rail(container))).toEqual(['Variedades'])
})

test('an archived variety on the phone reads "‹ Archivadas", and Back with no history goes there', async () => {
  const { router } = renderShell([SALES, pathTo(VARIETY, { id: 5 })], {
    index: 1,
    client: clientWith([], [ARCHIVED_5]),
  })

  expect(arrows().map((arrow) => arrow.textContent)).toEqual(['‹ Archivadas'])
  await userEvent.click(screen.getByRole('button', { name: '‹ Archivadas' }))

  expect(router.state.location.pathname).toBe(ARCHIVED_VARIETIES)
})

test('archived row to archived row on a computer, the new detail pending, keeps Archivadas\' chrome at every render', async () => {
  const { router, container } = renderShell([pathTo(VARIETY, { id: 5 })], {
    computer: true,
    client: clientWith([], [ARCHIVED_5, ARCHIVED_6]),
  })
  const watch = watchChrome(container)

  await act(() => router.navigate(pathTo(VARIETY, { id: 6 }), { replace: true }))

  expect(router.state.location.pathname).toBe(pathTo(VARIETY, { id: 6 }))
  expect(arrows().map((arrow) => arrow.textContent)).toEqual(['‹ Variedades'])
  expect(railNuevaVenta(container)).toHaveLength(0)
  expect(watch.flickers).toEqual([])
  watch.stop()
})

test('live row to live row on a computer keeps Variedades\' chrome at every render', async () => {
  const { router, container } = renderShell([pathTo(VARIETY, { id: 5 })], {
    computer: true,
    client: clientWith([CHERRY, BEEFSTEAK], []),
  })
  const watch = watchChrome(container)

  await act(() => router.navigate(pathTo(VARIETY, { id: 6 }), { replace: true }))

  expect(arrows()).toHaveLength(0)
  expect(railNuevaVenta(container)).toHaveLength(1)
  expect(watch.flickers).toEqual([])
  watch.stop()
})

test('a deep link to an archived variety with no list loaded is live until the detail resolves, then archived', async () => {
  let answer: (response: Response) => void = () => undefined
  const pending = new Promise<Response>((resolve) => {
    answer = resolve
  })
  const { container } = renderShell([pathTo(VARIETY, { id: 5 })], {
    computer: true,
    fetchImpl: () => pending,
  })

  expect(arrows()).toHaveLength(0)
  expect(railNuevaVenta(container)).toHaveLength(1)
  expect(current(rail(container))).toEqual(['Variedades'])

  await act(async () => {
    answer(json(200, detailOf(ARCHIVED_5)))
    await pending
  })

  await waitFor(() => expect(arrows().map((arrow) => arrow.textContent)).toEqual(['‹ Variedades']))
  expect(railNuevaVenta(container)).toHaveLength(0)
  expect(current(rail(container))).toEqual(['Variedades'])
})

test('on the phone the same deep link reads "‹ Variedades" first and "‹ Archivadas" once the detail resolves', async () => {
  let answer: (response: Response) => void = () => undefined
  const pending = new Promise<Response>((resolve) => {
    answer = resolve
  })
  renderShell([pathTo(VARIETY, { id: 5 })], { fetchImpl: () => pending })

  expect(arrows().map((arrow) => arrow.textContent)).toEqual(['‹ Variedades'])
  await act(async () => {
    answer(json(200, detailOf(ARCHIVED_5)))
    await pending
  })

  await waitFor(() => expect(arrows().map((arrow) => arrow.textContent)).toEqual(['‹ Archivadas']))
})

test.each([
  ['loading', () => NEVER, () => undefined],
  [
    'paused offline',
    () => NEVER,
    () => {
      onlineManager.setOnline(false)
    },
  ],
  ['an error', () => () => Promise.resolve(json(500, { detail: 'boom' })), () => undefined],
])('while the variety is %s the phone shows exactly one arrow, at the live parent', async (_state, fetchOf, before) => {
  before()
  renderShell([pathTo(VARIETY, { id: 5 })], { fetchImpl: fetchOf() })

  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20))
  })

  expect(arrows().map((arrow) => arrow.textContent)).toEqual(['‹ Variedades'])
})

test('"Ver todas" reads the variety\'s name at once when its list is cached, with no flash of "Variedad"', () => {
  const { container } = renderShell([pathTo(VARIETY_ENTRIES, { id: 5 })], { client: clientWith([CHERRY], []) })

  expect(arrows().map((arrow) => arrow.textContent)).toEqual(['‹ Cherry'])
  expect(container).not.toHaveTextContent('‹ Variedad')
})

test('"Ver todas" reads "‹ Variedad" while neither the detail nor a list knows the name', () => {
  renderShell([pathTo(VARIETY_ENTRIES, { id: 5 })])

  expect(arrows().map((arrow) => arrow.textContent)).toEqual(['‹ Variedad'])
})

test('a variety\'s facts never come from another id: a cached list without it leaves it unknown', () => {
  renderShell([pathTo(VARIETY, { id: 9 })], { client: clientWith([CHERRY], [ARCHIVED_6]) })

  expect(arrows().map((arrow) => arrow.textContent)).toEqual(['‹ Variedades'])
})

test('a non-numeric id is unknown, not a lookup', () => {
  renderShell([pathTo(VARIETY, { id: 'abc' })], { client: clientWith([], [ARCHIVED_5]) })

  expect(arrows().map((arrow) => arrow.textContent)).toEqual(['‹ Variedades'])
})
