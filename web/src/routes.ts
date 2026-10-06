/**
 * The route registry: the one place the front writes a path, and the one place that says
 * what kind of screen each path is. No other file in `web/src` or `web/e2e` carries a route
 * literal (a source scan in `routes.test.ts` fails if one does).
 *
 * Pure data and functions, with no import of any screen: the e2e specs import it too, and
 * they type-check under the node project, which has no JSX. `router.tsx` binds each declared
 * screen to its element (`bind`) and each public page through `outside`.
 *
 * Every screen under `Shell` is declared once with `screen()` and is exactly one `kind`:
 *   - `root`: a place of its own (the bar or the rail marks it); shows the bar and "+ Nueva venta".
 *   - `card`: a detail; shows the bar and a "‹ parent" arrow, no "+ Nueva venta".
 *   - `form`: a form or sheet; shows neither, and closes with "Cerrar".
 * Every route outside `Shell` (the public pages and the catch-all) is declared with
 * `outside()`; a route is one or the other, never both, never neither.
 *
 * `parentOf` and `placeOf` take the viewport because Configuración's list has a different
 * parent on the phone (Más) than on a computer (Inicio). A card or form has no place of its
 * own: `placeOf` walks its parent chain until a screen that declares one, so the mark never
 * depends on history, a reload or how the screen was opened.
 */

export type Viewport = 'phone' | 'computer'

/** Which kind of screen a route is; the chrome follows from it and from nothing else. */
export type Kind = 'root' | 'card' | 'form'

/** What the bottom bar can mark. */
export type BarPlace = 'home' | 'sales' | 'customers' | 'varieties' | 'more'

/** What the side rail can mark: the bar's places, Gastos, Análisis and the business row. */
export type RailPlace = BarPlace | 'expenses' | 'analysis' | 'business'

export interface Place {
  bar: BarPlace
  rail: RailPlace
}

export type ScreenId =
  | 'home'
  | 'more'
  | 'sales'
  | 'sale-new'
  | 'sale'
  | 'customers'
  | 'customer-new'
  | 'customer'
  | 'customer-edit'
  | 'customer-payment'
  | 'varieties'
  | 'variety'
  | 'catalog'
  | 'stock'
  | 'stock-entry-new'
  | 'stock-entry'
  | 'expenses'
  | 'expense-new'
  | 'analysis'
  | 'settings'
  | 'settings-business'
  | 'settings-users'
  | 'settings-integrations'
  | 'settings-catalog-message'
  | 'settings-expense-categories'
  | 'settings-appearance'
  | 'settings-account'

/** A screen's parent: one id, or one per viewport. */
export type Parent = ScreenId | { phone: ScreenId; computer: ScreenId }

// Paths. A `:name` segment is a parameter; `pathTo` fills it.
export const HOME = '/'
export const LOGIN = '/login'
export const INVITATION = '/invitation/:token'
export const RESET = '/reset/:token'
export const CATCH_ALL = '*'

export const SALES = '/sales'
export const SALE_NEW = '/sales/new'
export const SALE = '/sales/:id'

export const CUSTOMERS = '/customers'
export const CUSTOMER_NEW = '/customers/new'
export const CUSTOMER = '/customers/:id'
export const CUSTOMER_EDIT = '/customers/:id/edit'
export const CUSTOMER_PAYMENT = '/customers/:id/payment'

export const VARIETIES = '/varieties'
export const VARIETY = '/varieties/:id'
export const CATALOG = '/varieties/catalog'

export const STOCK = '/varieties/entries'
export const STOCK_ENTRY_NEW = '/varieties/entries/new'
export const STOCK_ENTRY = '/varieties/entries/:id'

export const MORE = '/more'
export const EXPENSES = '/expenses'
export const EXPENSE_NEW = '/expenses/new'
export const ANALYSIS = '/analysis'

/** The old Spanish spellings: no front code uses them, only the server redirects them (308).
 * Kept here so a test or an e2e spec can open one without writing the literal. */
export const LEGACY_BUSINESS = '/negocio'
export const LEGACY_EXPENSE_CATEGORIES = '/gastos/categorias'
export const LEGACY_MORE = '/mas'
export const LEGACY_EXPENSES = '/gastos'

export const SETTINGS = '/settings'
export const SETTINGS_BUSINESS = '/settings/business'
export const SETTINGS_USERS = '/settings/users'
export const SETTINGS_INTEGRATIONS = '/settings/integrations'
export const SETTINGS_CATALOG_MESSAGE = '/settings/catalog-message'
export const EXPENSE_CATEGORIES = '/settings/expense-categories'
export const SETTINGS_APPEARANCE = '/settings/appearance'
export const SETTINGS_ACCOUNT = '/settings/account'

/** Every old Spanish path and the route it moved to, whole path (a `:id` carries across). The
 * server's `LEGACY_FRONT_PATHS` answers each with a 308; the e2e spec opens them one by one. */
export const LEGACY_REDIRECTS: readonly (readonly [old: string, now: string])[] = [
  ['/ventas', SALES],
  ['/ventas/nueva', SALE_NEW],
  ['/ventas/:id', SALE],
  ['/clientes', CUSTOMERS],
  ['/clientes/deben', CUSTOMERS],
  ['/clientes/nuevo', CUSTOMER_NEW],
  ['/clientes/:id', CUSTOMER],
  ['/clientes/:id/editar', CUSTOMER_EDIT],
  ['/mi-stock', VARIETIES],
  ['/mi-stock/nueva-entrada', STOCK_ENTRY_NEW],
  ['/mi-stock/entradas/:id', STOCK_ENTRY],
  ['/variedades', VARIETIES],
  ['/variedades/:id', VARIETY],
  ['/analisis', ANALYSIS],
  [LEGACY_EXPENSES, EXPENSES],
  [LEGACY_EXPENSE_CATEGORIES, EXPENSE_CATEGORIES],
  [LEGACY_MORE, MORE],
  ['/catalogo', CATALOG],
  [LEGACY_BUSINESS, SETTINGS],
  ['/entrar', LOGIN],
]

/** Fills a template's `:name` segments: `pathTo(SALE, { id: 7 })` is `/ventas/7`. */
export function pathTo(template: string, params: Readonly<Record<string, string | number>> = {}): string {
  return template.replace(/:([A-Za-z]+)/g, (_match, name: string) => {
    const value = params[name]
    if (value === undefined) throw new Error(`pathTo: ${template} needs ${name}`)
    return encodeURIComponent(String(value))
  })
}

/** The path as a route-table segment (`'/more'` → `'more'`). */
export function relative(path: string): string {
  return path.replace(/^\//, '')
}

interface ScreenBase {
  id: ScreenId
  path: string
  /** The word "‹ <title>" shows when this screen is somebody's parent. */
  title: string
  /** Which pane a two-pane screen fills; inert until the area issues build the panes. */
  pane?: 'list' | 'detail'
}

export type Screen =
  | (ScreenBase & { kind: 'root'; place: Place; parent?: undefined })
  | (ScreenBase & { kind: 'card'; parent: Parent; place?: Place })
  | (ScreenBase & { kind: 'form'; parent: Parent; place?: undefined })

/** Declares a screen under `Shell`. Returns it as given: the type is the check. */
export function screen<S extends Screen>(declaration: S): S {
  return declaration
}

export interface Outside {
  path: string
}

/** Declares a route outside `Shell`: a public page or the catch-all. */
export function outside<O extends Outside>(declaration: O): O {
  return declaration
}

export const SCREENS: readonly Screen[] = [
  screen({ id: 'home', path: HOME, kind: 'root', title: 'Inicio', place: { bar: 'home', rail: 'home' } }),
  screen({ id: 'more', path: MORE, kind: 'root', title: 'Más', place: { bar: 'more', rail: 'more' } }),

  screen({ id: 'sales', path: SALES, kind: 'root', title: 'Ventas', place: { bar: 'sales', rail: 'sales' } }),
  screen({ id: 'sale-new', path: SALE_NEW, kind: 'form', title: 'Nueva venta', parent: 'sales' }),
  screen({ id: 'sale', path: SALE, kind: 'card', title: 'Venta', parent: 'sales' }),

  screen({
    id: 'customers',
    path: CUSTOMERS,
    kind: 'root',
    title: 'Clientes',
    pane: 'list',
    place: { bar: 'customers', rail: 'customers' },
  }),
  screen({ id: 'customer-new', path: CUSTOMER_NEW, kind: 'form', title: 'Nuevo cliente', parent: 'customers' }),
  screen({ id: 'customer', path: CUSTOMER, kind: 'card', title: 'Cliente', pane: 'detail', parent: 'customers' }),
  screen({ id: 'customer-edit', path: CUSTOMER_EDIT, kind: 'form', title: 'Editar cliente', parent: 'customer' }),
  screen({ id: 'customer-payment', path: CUSTOMER_PAYMENT, kind: 'form', title: 'Registrar cobro', parent: 'customer' }),

  screen({
    id: 'varieties',
    path: VARIETIES,
    kind: 'root',
    title: 'Variedades',
    pane: 'list',
    place: { bar: 'varieties', rail: 'varieties' },
  }),
  screen({ id: 'variety', path: VARIETY, kind: 'card', title: 'Variedad', pane: 'detail', parent: 'varieties' }),
  screen({ id: 'catalog', path: CATALOG, kind: 'card', title: 'Catálogo', parent: 'varieties' }),
  screen({ id: 'stock', path: STOCK, kind: 'card', title: 'Stock', parent: 'varieties' }),
  screen({ id: 'stock-entry-new', path: STOCK_ENTRY_NEW, kind: 'form', title: 'Entrada de stock', parent: 'stock' }),
  screen({ id: 'stock-entry', path: STOCK_ENTRY, kind: 'form', title: 'Entrada de stock', parent: 'stock' }),

  screen({
    id: 'expenses',
    path: EXPENSES,
    kind: 'root',
    title: 'Gastos',
    place: { bar: 'more', rail: 'expenses' },
  }),
  screen({ id: 'expense-new', path: EXPENSE_NEW, kind: 'form', title: 'Gasto nuevo', parent: 'expenses' }),
  screen({
    id: 'analysis',
    path: ANALYSIS,
    kind: 'root',
    title: 'Análisis',
    place: { bar: 'more', rail: 'analysis' },
  }),

  screen({
    id: 'settings',
    path: SETTINGS,
    kind: 'card',
    title: 'Configuración',
    parent: { phone: 'more', computer: 'home' },
    place: { bar: 'more', rail: 'business' },
  }),
  screen({ id: 'settings-business', path: SETTINGS_BUSINESS, kind: 'form', title: 'Negocio', parent: 'settings' }),
  screen({ id: 'settings-users', path: SETTINGS_USERS, kind: 'form', title: 'Usuarios', parent: 'settings' }),
  screen({
    id: 'settings-integrations',
    path: SETTINGS_INTEGRATIONS,
    kind: 'form',
    title: 'Integraciones',
    parent: 'settings',
  }),
  screen({
    id: 'settings-catalog-message',
    path: SETTINGS_CATALOG_MESSAGE,
    kind: 'form',
    title: 'Mensaje del catálogo',
    parent: 'settings',
  }),
  screen({
    id: 'settings-expense-categories',
    path: EXPENSE_CATEGORIES,
    kind: 'form',
    title: 'Categorías de gastos',
    parent: 'settings',
  }),
  screen({
    id: 'settings-appearance',
    path: SETTINGS_APPEARANCE,
    kind: 'form',
    title: 'Apariencia',
    parent: 'settings',
  }),
  screen({ id: 'settings-account', path: SETTINGS_ACCOUNT, kind: 'form', title: 'Tu cuenta', parent: 'settings' }),
]

/** The public pages and the catch-all: every route outside `Shell`. No front code redirects a
 * Spanish path; the server's `LEGACY_FRONT_PATHS` does (308). */
export const OUTSIDE: readonly Outside[] = [
  outside({ path: LOGIN }),
  outside({ path: INVITATION }),
  outside({ path: RESET }),
  outside({ path: CATCH_ALL }),
]

/** The registry entry of one screen. A missing id is a bug in the declaration, so it throws. */
export function screenOf(id: ScreenId): Screen {
  const found = SCREENS.find((candidate) => candidate.id === id)
  if (found === undefined) throw new Error(`routes: no screen declared as ${id}`)
  return found
}

function parentIdOf(entry: Screen, viewport: Viewport): ScreenId | undefined {
  if (entry.parent === undefined) return undefined
  return typeof entry.parent === 'string' ? entry.parent : entry.parent[viewport]
}

export interface ParentRef {
  id: ScreenId
  /** The parent's path template; `pathTo` fills it when the parent has parameters. */
  path: string
  /** The "‹ <title>" label. */
  title: string
}

/** The screen's fixed parent: the "‹ parent" label and the back fallback, from one result. */
export function parentOf(id: ScreenId, viewport: Viewport): ParentRef | undefined {
  const parentId = parentIdOf(screenOf(id), viewport)
  if (parentId === undefined) return undefined
  const parent = screenOf(parentId)
  return { id: parent.id, path: parent.path, title: parent.title }
}

/** The bar's and the rail's mark for the screen: its own, else its nearest ancestor's. */
export function placeOf(id: ScreenId, viewport: Viewport): Place {
  const seen = new Set<ScreenId>()
  let entry: Screen | undefined = screenOf(id)
  while (entry !== undefined) {
    if (entry.place !== undefined) return entry.place
    if (seen.has(entry.id)) throw new Error(`routes: ${id} has a parent cycle`)
    seen.add(entry.id)
    const parentId = parentIdOf(entry, viewport)
    entry = parentId === undefined ? undefined : screenOf(parentId)
  }
  throw new Error(`routes: ${id} has no place in its parent chain`)
}

/** Whether `value` names a declared screen; a route's `handle.screen` is checked with it. */
export function isScreenId(value: unknown): value is ScreenId {
  return SCREENS.some((candidate) => candidate.id === value)
}

function matchesTemplate(path: string, template: string): boolean {
  const have = path.split('/')
  const want = template.split('/')
  return (
    have.length === want.length &&
    want.every((segment, index) => (segment.startsWith(':') ? have[index] !== '' : segment === have[index]))
  )
}

/** Whether `path` is one of the public pages (Entrar, an invitation, a reset). */
export function isPublicPath(path: string): boolean {
  return [LOGIN, INVITATION, RESET].some((template) => matchesTemplate(path, template))
}
